
const NovaStartup = {
  start() {
    const loader = document.getElementById("app-loader");

    if (!loader) return;

    const finishStartup = () => {
      loader.classList.add("is-finished");

      window.setTimeout(() => {
        loader.remove();
      }, 550);
    };

    if (document.readyState === "complete") {
      window.setTimeout(finishStartup, 350);
    } else {
      window.addEventListener("load", () => {
        window.setTimeout(finishStartup, 350);
      }, { once: true });
    }
  }
};

NovaStartup.start();
