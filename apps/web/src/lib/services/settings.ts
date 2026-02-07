/**
 * Settings service for managing application settings
 */
import { db } from "@repo/db";
import { settings, settingsHistory } from "@repo/db";
import type {
  SettingKey,
  SettingValue,
  SettingHistoryEntry,
} from "@repo/types";
import { eq, desc } from "drizzle-orm";
import { cache } from "react";

const FALLBACK_SETTINGS_META: Record<string, { description: string }> = {
  "ai.widget.enabled": {
    description: "Enable the embeddable AI widget",
  },
  "ai.widget.tools.create": {
    description: "Allow the widget to create new pages",
  },
  "ai.widget.tools.edit": {
    description: "Allow the widget to edit existing pages",
  },
  "ai.widget.tools.summarize": {
    description: "Allow the widget to summarize pages",
  },
  "ai.widget.tools.search": {
    description: "Allow the widget to search and answer questions",
  },
};

/**
 * Get a single setting by key
 * @param key The setting key
 * @returns The setting value or the default value if not found
 */
export async function getSetting<K extends SettingKey>(
  key: K
): Promise<SettingValue<K>> {
  const result = await db.query.settings.findFirst({
    where: eq(settings.key, key),
    columns: { value: true },
  });

  // If the setting doesn't exist in the database, return the default value
  if (!result) {
    // Note: We're doing a dynamic import here to avoid circular dependencies
    // Fallback defaults for newly added settings until types package is rebuilt
    const fallbackDefaults: Partial<Record<SettingKey, SettingValue<SettingKey>>> =
      {
        "ai.widget.enabled": false,
        "ai.widget.tools.create": false,
        "ai.widget.tools.edit": false,
        "ai.widget.tools.summarize": false,
        "ai.widget.tools.search": true,
      };
    try {
      const { getDefaultSetting } = await import("@repo/types");
      return getDefaultSetting(key);
    } catch {
      if (key in fallbackDefaults) {
        return fallbackDefaults[key] as SettingValue<K>;
      }
      throw new Error(`Missing default setting for key: ${key}`);
    }
  }

  return result.value as SettingValue<K>;
}

/**
 * Get multiple settings by their keys
 * @param keys The setting keys
 * @returns Object with requested settings
 */
export async function getSettings<K extends SettingKey>(
  keys: K[]
): Promise<Record<K, SettingValue<K>>> {
  const results = await Promise.all(keys.map((key) => getSetting(key)));

  return keys.reduce(
    (acc, key, index) => {
      acc[key] = results[index] as SettingValue<K>;
      return acc;
    },
    {} as Record<K, SettingValue<K>>
  );
}

/**
 * Get all settings from the database
 * @returns All settings
 */
export async function getAllSettings(): Promise<
  Partial<{ [K in SettingKey]: SettingValue<K> }>
> {
  const results = await db.query.settings.findMany();
  const settingsMap: Partial<{ [K in SettingKey]: SettingValue<K> }> = {};

  for (const setting of results) {
    const key = setting.key as SettingKey;
    // Type assertion still needed for the value from DB
    // @ts-expect-error - TODO: fix this
    settingsMap[key] = setting.value as SettingValue<typeof key>;
  }

  return settingsMap;
}

/**
 * Update a setting value with history tracking
 * @param key The setting key
 * @param value The new value
 * @param userId The ID of the user making the change
 * @param reason Optional reason for the change
 */
export async function updateSetting<K extends SettingKey>(
  key: K,
  value: SettingValue<K>,
  userId: number,
  reason?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Get current value to store as previous
    const currentSetting = await tx.query.settings.findFirst({
      where: eq(settings.key, key),
      columns: { value: true },
    });
    const previousValue = currentSetting?.value ?? null;

    // 2. Insert into history if the value exists and is changing
    if (previousValue !== null) {
      await tx.insert(settingsHistory).values({
        settingKey: key,
        previousValue: previousValue,
        changedById: userId,
        changeReason: reason ?? null,
        // changedAt will default to now()
      });
    }

    // 3. Update or insert the setting
    const definitions = (await import("@repo/types")).DEFAULT_SETTINGS as Record<
      string,
      { description?: string }
    >;
    const fallbackMeta = FALLBACK_SETTINGS_META[key as string];
    const description =
      definitions[key as string]?.description ??
      fallbackMeta?.description ??
      `Setting ${key}`;
    await tx
      .insert(settings)
      .values({
        key: key,
        value: value as any, // Type cast needed due to DB Jsonb vs specific types
        description,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: value as any, // Type cast needed
          updatedAt: new Date(),
        },
      });
  });
}

/**
 * Delete a setting (restores to default value)
 * @param key The setting key
 * @param userId The ID of the user making the change
 * @param reason Optional reason for the change
 */
export async function deleteSetting<K extends SettingKey>(
  key: K,
  userId: number,
  reason?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Get current value to store as history
    const currentSetting = await tx.query.settings.findFirst({
      where: eq(settings.key, key),
      columns: { value: true },
    });

    if (currentSetting) {
      // 2. Add to history
      await tx.insert(settingsHistory).values({
        settingKey: key,
        previousValue: currentSetting.value,
        changedById: userId,
        changeReason: reason ?? "Restored to default",
      });

      // 3. Delete the setting
      await tx.delete(settings).where(eq(settings.key, key));
    }
  });
}

/**
 * Get setting history for a specific setting
 * @param key The setting key
 * @returns Array of history entries
 */
export async function getSettingHistory<K extends SettingKey>(
  key: K
): Promise<SettingHistoryEntry<K>[]> {
  const history = await db.query.settingsHistory.findMany({
    where: eq(settingsHistory.settingKey, key),
    orderBy: [desc(settingsHistory.changedAt)],
    with: {
      changedBy: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return history.map((entry) => ({
    id: entry.id,
    settingKey: entry.settingKey as K,
    previousValue: entry.previousValue as SettingValue<K>,
    changedById: entry.changedById,
    changedAt: entry.changedAt,
    changeReason: entry.changeReason,
  }));
}

/**
 * Initialize default settings if they don't exist
 */
export async function initializeDefaultSettings(): Promise<void> {
  const { DEFAULT_SETTINGS } = await import("@repo/types");

  // Get all defined setting keys
  const allKeys = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

  // Check which settings already exist in the database
  const existingSettings = await db.query.settings.findMany({
    columns: { key: true },
  });
  const existingKeys = new Set(existingSettings.map((s) => s.key));

  // Filter out keys that already exist
  const keysToCreate = allKeys.filter((key) => !existingKeys.has(key));

  // Create missing settings with default values
  if (keysToCreate.length > 0) {
    await db.transaction(async (tx) => {
      for (const key of keysToCreate) {
        const setting = DEFAULT_SETTINGS[key];
        await tx.insert(settings).values({
          key,
          value: setting.value,
          description: setting.description,
        });
      }
    });

    console.log(`Initialized ${keysToCreate.length} default settings`);
  }
}

/**
 * Cached version of getSetting for use in React Server Components
 */
export const getCachedSetting = cache(getSetting);

/**
 * Cached version of getAllSettings for use in React Server Components
 */
export const getCachedAllSettings = cache(getAllSettings);
