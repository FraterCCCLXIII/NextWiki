import { MainLayout } from "~/components/layout/MainLayout";
import { getSettingValue } from "~/lib/utils/settings";
import { EmptyPageGenerator } from "~/components/wiki/EmptyPageGenerator";

export default async function WikiNotFound() {
  const showGenerate = await getSettingValue("ai.showGenerateOnEmptyPage");
  const publishOnGenerate = await getSettingValue("ai.publishGeneratedPages");

  return (
    <MainLayout>
      <EmptyPageGenerator
        showGenerate={showGenerate}
        publishOnGenerate={publishOnGenerate}
      />
    </MainLayout>
  );
}
