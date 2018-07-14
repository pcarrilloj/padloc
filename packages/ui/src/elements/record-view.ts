import { Store, Record, Field } from "@padlock/core/lib/data.js";
import { localize as $l } from "@padlock/core/lib/locale.js";
import sharedStyles from "../styles/shared.js";
import { View } from "./view.js";
import { confirm, prompt, choose, openField, generate, getDialog } from "../dialog.js";
import { animateCascade } from "../animation.js";
import { app } from "../init.js";
import { html, property, query, listen, observe } from "./base.js";
import "./icon.js";
import { Input } from "./input.js";
import "./record-field.js";
import "./field-dialog.js";

export class RecordView extends View {
    @property() store: Store | null = null;
    @property() record: Record | null = null;

    @query("#nameInput") _nameInput: Input;

    @listen("lock", app)
    _locked() {
        this.record = null;
        const fieldDialog = getDialog("pl-field-dialog");
        fieldDialog.open = false;
        fieldDialog.field = null;
    }

    @listen("record-changed", app)
    _recordChanged(e: CustomEvent) {
        if (e.detail.record === this.record) {
            this.requestRender();
        }
    }

    _shouldRender() {
        return super._shouldRender() && !!this.record;
    }

    _render({ record }: this) {
        const { name, fields, tags } = record!;

        return html`
        <style>

            ${sharedStyles}

            :host {
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                position: relative;
                @apply --fullbleed;
                transition: background 0.5s;
                background: var(--color-quaternary);
            }

            #background {
                @apply --fullbleed;
            }

            header > pl-input {
                flex: 1;
                width: 0;
            }

            .name {
                font-weight: bold;
                text-align: center;
            }

            pl-record-field, .add-button-wrapper {
                transform: translate3d(0, 0, 0);
                margin: 6px;
                @apply --card;
            }

            .add-button {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .add-button pl-icon {
                width: 30px;
                position: relative;
                top: 1px;
            }

            .tags {
                display: flex;
                overflow-x: auto;
                margin: 8px 0;
                padding: 0 8px;
                /* align-items: center; */
                -webkit-overflow-scrolling: touch;
            }

            .tags::after {
                content: "";
                display: block;
                width: 1px;
                flex: none;
            }

            .tag {
                background: var(--color-foreground);
                color: var(--color-background);
                font-weight: bold;
                border-radius: var(--border-radius);
                margin-right: 6px;
                display: flex;
                align-items: center;
                font-size: var(--font-size-tiny);
                white-space: nowrap;
                line-height: 0;
                padding-left: 12px;
            }

            .tags pl-icon {
                width: 30px;
                height: 30px;
            }

            .tag.add {
                padding-left: 0;
                padding-right: 12px;
                border: dashed 1px;
                background: transparent;
                color: var(--color-foreground);
            }
        </style>

        <header>

            <pl-icon icon="close" class="tap" on-click="${() => this._back()}"></pl-icon>

            <pl-input
                id="nameInput"
                class="name tap"
                value="${name}"
                placeholder="${$l("Enter Record Name")}"
                select-on-focus=""
                autocapitalize=""
                on-change="${() => this._updateName()}"
                on-enter="${() => this._nameEnter()}">
            </pl-input>

            <pl-icon icon="delete" class="tap" on-click="${() => this._deleteRecord()}"></pl-icon>

        </header>

        <main id="main">

            <div class="tags animate">

                ${tags.map(
                    (tag: string) => html`
                    <div class="tag tap" on-click="${() => this._removeTag(tag)}">
                        <div class="tag-name">${tag}</div>
                        <pl-icon icon="cancel"></pl-icon>
                    </div>
                `
                )}

                <div class="tag add tap" on-click="${() => this._addTag()}">

                    <pl-icon icon="tag"></pl-icon>

                    <div>${$l("Add Tag")}</div>

                </div>

            </div>

            <div class="fields">

                ${fields.map(
                    (field: Field, index: number) => html`

                    <div class="animate">

                        <pl-record-field
                            field="${field}"
                            record="${record}"
                            on-field-change="${(e: CustomEvent) => this._changeField(index, e.detail.changes)}"
                            on-field-delete="${() => this._deleteField(index)}">
                        </pl-record-field>

                    </div>

                `
                )}
            </div>

            <div class="add-button-wrapper animate">

                <button class="add-button tap" on-click="${() => this._addField()}">

                    <pl-icon icon="add"></pl-icon>

                    <div>${$l("Add Field")}</div>

                </button>

            </div>

        </main>

        <div class="rounded-corners"></div>
`;
    }

    _didRender() {
        setTimeout(() => {
            if (this.record && !this.record.name) {
                this._nameInput.focus();
            }
        }, 500);
    }

    _updateName() {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        app.updateRecord(this.store, this.record, { name: this._nameInput.value });
    }

    async _deleteField(index: number) {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        const confirmed = await confirm($l("Are you sure you want to delete this field?"), $l("Delete"));
        const fields = this.record.fields.filter((_, i) => i !== index);
        if (confirmed) {
            app.updateRecord(this.store, this.record, { fields: fields });
        }
    }

    async _changeField(index: number, changes: { name?: string; value?: string; masked?: boolean }) {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        const fields = [...this.record.fields];
        fields[index] = Object.assign({}, fields[index], changes);
        app.updateRecord(this.store, this.record, { fields: fields });
    }

    async _deleteRecord() {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        const confirmed = await confirm($l("Are you sure you want to delete this record?"), $l("Delete"));
        if (confirmed) {
            app.deleteRecords(this.store, this.record);
        }
    }

    async _addField(field = { name: "", value: "", masked: false }) {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        const result = await openField(field, true);
        switch (result.action) {
            case "generate":
                const value = await generate();
                field.value = value;
                field.name = result.name;
                this._addField(field);
                break;
            case "edit":
                Object.assign(field, result);
                app.updateRecord(this.store, this.record, { fields: this.record.fields.concat([field]) });
                break;
        }
    }

    _fieldButtonClicked() {
        this._addField();
    }

    _hasTags() {
        return !!this.record && !!this.record.tags.length;
    }

    async _removeTag(tag: string) {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        const confirmed = await confirm($l("Do you want to remove this tag?"), $l("Remove"), $l("Cancel"), {
            title: $l("Remove Tag")
        });
        if (confirmed) {
            app.updateRecord(this.store, this.record, { tags: this.record.tags.filter(t => t !== tag) });
        }
    }

    async _createTag() {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        const tag = await prompt("", {
            placeholder: $l("Enter Tag Name"),
            confirmLabel: $l("Add Tag"),
            preventDismiss: false,
            cancelLabel: ""
        });
        if (tag && !this.record.tags.includes(tag)) {
            app.updateRecord(this.store, this.record, { tags: this.record.tags.concat([tag]) });
        }
    }

    async _addTag() {
        if (!this.store || !this.record) {
            throw "store or record member not set";
        }
        const tags = this.store.tags.filter((tag: string) => !this.record!.tags.includes(tag));
        if (!tags.length) {
            return this._createTag();
        }

        const choice = await choose("", tags.concat([$l("New Tag")]), { preventDismiss: false });
        if (choice == tags.length) {
            return this._createTag();
        }

        const tag = tags[choice];
        if (tag) {
            app.updateRecord(this.store, this.record, { tags: this.record.tags.concat([tag]) });
        }
    }

    _nameEnter() {
        this._nameInput.blur();
    }

    @observe("active")
    _animate() {
        if (this.active) {
            setTimeout(() => {
                animateCascade(this.$$(".animate"), { fullDuration: 800, fill: "both" });
            }, 100);
        }
    }

    edit() {
        this._nameInput.focus();
    }
}

window.customElements.define("pl-record-view", RecordView);
