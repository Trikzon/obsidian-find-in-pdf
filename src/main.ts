import {FileView, Plugin, Scope} from "obsidian";
import {FoundInPageEvent, WebviewTag} from "electron";

export default class FindInPdfPlugin extends Plugin {
    private scope: Scope;
    private ogCheckCallback: Function;

	async onload() {
        app.workspace.onLayoutReady(() => {
            // TODO: Replace with monkey-around
            this.ogCheckCallback = app.commands.commands["editor:open-search"].checkCallback;
            app.commands.commands["editor:open-search"].checkCallback = (checking: boolean) => {
                const activeView = app.workspace.getActiveViewOfType(FileView);
                if (!activeView) { return this.ogCheckCallback(); }
                if (activeView.file.extension !== "pdf") { return this.ogCheckCallback(); }

                const searchContainer = activeView.contentEl.find(".document-search-container");
                if (!searchContainer) { return this.ogCheckCallback(); }

                if (!checking) {
                    console.log("Find");
                    searchContainer.style.display = searchContainer.style.display === "" ? "none" : "";
                }

                return true;
            };
        });

		this.registerEvent(app.workspace.on("layout-change", () => {
			const activeView = app.workspace.getActiveViewOfType(FileView);
			if (!activeView) { return; }
			if (activeView.file.extension !== "pdf") { return; }

			// Remove Obsidian's original iframe embed of the PDF file.
			while (activeView.contentEl.lastChild !== null) {
				activeView.contentEl.removeChild(activeView.contentEl.lastChild);
			}

			// Create webview embed of the PDF file.
			const webview = document.createElement("webview") as WebviewTag;
			webview.addClass("find-in-pdf-webview");
			webview.src = app.vault.getResourcePath(activeView.file);
			activeView.contentEl.appendChild(webview);

			// Create find elements
			const container = document.createElement("div");
			// CSS class makes webview fill the entire tab's content space.
			container.addClass("document-search-container");
			// Hide find elements at initialization.
			container.style.display = "none";
			activeView.contentEl.prepend(container);

			const search = container.createEl("div", { cls: "document-search" });
			const input = search.createEl("input", {
				cls: "document-search-input",
				placeholder: "Find",
				type: "text"
			});

			const activeMatch = search.createEl("div", { cls: "find-in-pdf-active-match" });
			const ordinal = activeMatch.createEl("div", { text: "0" });
			activeMatch.createEl("div", { text: "/" });
			const matches = activeMatch.createEl("div", { text: "0" });

			// TODO: Add aria-labels to the buttons.
			const searchButtons = search.createEl("div", { cls: "document-search-buttons" });
			const prev = searchButtons.createEl("button", { cls: "document-search-button", text: "Prev" });
			const next = searchButtons.createEl("button", { cls: "document-search-button", text: "Next" });
			const close = searchButtons.createEl("span", { cls: "document-search-close-button" });

			webview.addEventListener("found-in-page", (event: FoundInPageEvent) => {
				ordinal.innerText = event.result.activeMatchOrdinal.toString();
				matches.innerText = event.result.matches.toString();
			});

			input.addEventListener("input", (_: Event) => {
				if (input.value !== "") {
					webview.findInPage(input.value, {
						forward: true,
						findNext: true,
						matchCase: false
					});
				} else {
					webview.stopFindInPage("clearSelection");
					ordinal.innerText = "0";
					matches.innerText = "0";
				}
			});
			input.addEventListener("keydown", (event: KeyboardEvent) => {
				if (input.value !== "" && event.key === "Enter") {
					webview.findInPage(input.value, {
						forward: !event.shiftKey,
						findNext: false,
						matchCase: false
					});
				} else if (event.key === "Escape") {
                    container.style.display = "none";
                }
			});

			prev.addEventListener("click", (_: MouseEvent) => {
				if (input.value !== "") {
					webview.findInPage(input.value, {
						forward: false,
						findNext: false,
						matchCase: false
					});
				}
			});
			next.addEventListener("click", (_: MouseEvent) => {
				if (input.value !== "") {
					webview.findInPage(input.value, {
						forward: true,
						findNext: false,
						matchCase: false
					});
				}
			});

            close.addEventListener("click", (_: MouseEvent) => {
                container.style.display = "none";
            });
		}));
	}

	onunload() {
        if (this.ogCheckCallback) {
            app.commands.commands["editor:open-search"].checkCallback = this.ogCheckCallback;
        }
	}
}
