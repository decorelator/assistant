const controlsContainer = document.querySelector("[data-controls-container]");

async function loadControlsMarkup() {
  if (!controlsContainer) {
    throw new Error("Controls container not found.");
  }

  const response = await fetch("/controls.html");

  if (!response.ok) {
    throw new Error("Could not load controls.");
  }

  controlsContainer.innerHTML = await response.text();
}

async function bootstrap() {
  await loadControlsMarkup();
  await import("./main.js");
}

void bootstrap().catch((error) => {
  if (controlsContainer) {
    controlsContainer.innerHTML = `
      <section class="control-panel">
        <div class="status">${error instanceof Error ? error.message : "Could not load controls."}</div>
      </section>
    `;
  }
});
