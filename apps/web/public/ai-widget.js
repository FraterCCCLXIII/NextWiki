(function () {
  var currentScript = document.currentScript;
  if (!currentScript || currentScript.getAttribute("data-nextwiki-widget") === null) {
    return;
  }

  var baseUrl =
    currentScript.getAttribute("data-base-url") ||
    (function () {
      try {
        return new URL(currentScript.src).origin;
      } catch (e) {
        return "";
      }
    })();

  if (!baseUrl) {
    return;
  }

  var launcherSrc = baseUrl + "/ai-widget-launcher.html";
  var messengerSrc = baseUrl + "/widget/ai/messenger";

  var wrapper = document.createElement("div");
  wrapper.id = "nextwiki-ai-widget";
  wrapper.style.position = "fixed";
  wrapper.style.bottom = "24px";
  wrapper.style.right = "24px";
  wrapper.style.zIndex = "9999";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "flex-end";
  wrapper.style.gap = "12px";

  var messengerFrame = document.createElement("iframe");
  messengerFrame.title = "NextWiki AI Messenger";
  messengerFrame.src = messengerSrc;
  messengerFrame.style.width = "360px";
  messengerFrame.style.height = "560px";
  messengerFrame.style.border = "0";
  messengerFrame.style.borderRadius = "16px";
  messengerFrame.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.25)";
  messengerFrame.style.display = "none";
  messengerFrame.setAttribute("allow", "clipboard-read; clipboard-write");

  var launcherFrame = document.createElement("iframe");
  launcherFrame.title = "NextWiki AI Launcher";
  launcherFrame.src = launcherSrc;
  launcherFrame.style.width = "56px";
  launcherFrame.style.height = "56px";
  launcherFrame.style.border = "0";
  launcherFrame.style.borderRadius = "999px";
  launcherFrame.style.boxShadow = "0 10px 20px rgba(0, 0, 0, 0.25)";
  launcherFrame.style.background = "#ffffff";
  launcherFrame.setAttribute("allow", "clipboard-read; clipboard-write");

  wrapper.appendChild(messengerFrame);
  wrapper.appendChild(launcherFrame);
  document.body.appendChild(wrapper);

  var isOpen = false;
  var toggleMessenger = function () {
    isOpen = !isOpen;
    messengerFrame.style.display = isOpen ? "block" : "none";
  };

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "nextwiki-widget-toggle") return;
    toggleMessenger();
  });
})();
