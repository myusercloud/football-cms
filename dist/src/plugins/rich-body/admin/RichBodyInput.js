"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RichBodyInput = void 0;
const react_1 = __importStar(require("react"));
const react_2 = require("@tiptap/react");
const starter_kit_1 = __importDefault(require("@tiptap/starter-kit"));
const extension_mention_1 = __importDefault(require("@tiptap/extension-mention"));
const MentionList_1 = require("./MentionList");
// ── Suggestion config ─────────────────────────────────────────────────────────
function buildSuggestion() {
    return {
        char: '@',
        allowSpaces: false,
        minLength: 1,
        items: async ({ query }) => {
            if (!query)
                return [];
            try {
                const res = await fetch(`/api/rich-body/search?q=${encodeURIComponent(query)}`);
                if (!res.ok)
                    return [];
                return res.json();
            }
            catch {
                return [];
            }
        },
        render: () => {
            let renderer;
            let wrapper;
            let rect = null;
            const reposition = () => {
                if (!wrapper || !rect)
                    return;
                wrapper.style.top = `${rect.bottom + window.scrollY + 4}px`;
                wrapper.style.left = `${rect.left + window.scrollX}px`;
            };
            return {
                onStart(props) {
                    var _a;
                    rect = (_a = props.clientRect) === null || _a === void 0 ? void 0 : _a.call(props);
                    wrapper = document.createElement('div');
                    wrapper.style.cssText = 'position:absolute;z-index:9999';
                    document.body.appendChild(wrapper);
                    reposition();
                    renderer = new react_2.ReactRenderer(MentionList_1.MentionList, {
                        props,
                        editor: props.editor,
                    });
                    wrapper.appendChild(renderer.element);
                },
                onUpdate(props) {
                    var _a;
                    rect = (_a = props.clientRect) === null || _a === void 0 ? void 0 : _a.call(props);
                    reposition();
                    renderer.updateProps(props);
                },
                onKeyDown(props) {
                    var _a, _b;
                    if (props.event.key === 'Escape') {
                        wrapper === null || wrapper === void 0 ? void 0 : wrapper.remove();
                        renderer === null || renderer === void 0 ? void 0 : renderer.destroy();
                        return true;
                    }
                    return (_b = (_a = renderer.ref) === null || _a === void 0 ? void 0 : _a.onKeyDown(props.event)) !== null && _b !== void 0 ? _b : false;
                },
                onExit() {
                    wrapper === null || wrapper === void 0 ? void 0 : wrapper.remove();
                    renderer === null || renderer === void 0 ? void 0 : renderer.destroy();
                },
            };
        },
    };
}
// ── MentionExtension ──────────────────────────────────────────────────────────
const MentionExtension = extension_mention_1.default.configure({
    // Store entityType, entitySlug, entityName alongside the default `id` attr
    addAttributes() {
        return {
            id: { default: null },
            entityType: { default: null },
            entitySlug: { default: null },
            entityName: { default: null },
            href: { default: null },
        };
    },
    renderLabel({ node }) {
        var _a, _b;
        return `@${(_b = (_a = node.attrs.entityName) !== null && _a !== void 0 ? _a : node.attrs.id) !== null && _b !== void 0 ? _b : ''}`;
    },
    suggestion: buildSuggestion(),
});
// ── Editor ────────────────────────────────────────────────────────────────────
function RichBodyInput({ value, onChange, disabled }) {
    const lastJson = (0, react_1.useRef)('');
    const editor = (0, react_2.useEditor)({
        extensions: [starter_kit_1.default, MentionExtension],
        editable: !disabled,
        content: (() => {
            if (!value)
                return '';
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        })(),
        onUpdate({ editor }) {
            const json = JSON.stringify(editor.getJSON());
            if (json !== lastJson.current) {
                lastJson.current = json;
                onChange === null || onChange === void 0 ? void 0 : onChange(json);
            }
        },
    });
    return (<div style={editorStyles.wrap}>
      <Toolbar editor={editor}/>
      <react_2.EditorContent editor={editor} style={editorStyles.content}/>
      <style>{proseMirrorCss}</style>
    </div>);
}
exports.RichBodyInput = RichBodyInput;
// ── Toolbar ───────────────────────────────────────────────────────────────────
function Toolbar({ editor }) {
    if (!editor)
        return null;
    const btn = (label, action, active) => (<button key={label} type="button" onClick={action} style={{ ...editorStyles.btn, ...(active ? editorStyles.btnActive : {}) }} title={label}>
      {label}
    </button>);
    return (<div style={editorStyles.toolbar}>
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
      {btn('"', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {btn('•', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('1.', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      <span style={editorStyles.hint}>Type @ to mention a player or club</span>
    </div>);
}
// ── Styles ────────────────────────────────────────────────────────────────────
const editorStyles = {
    wrap: {
        border: '1px solid #dcdce4',
        borderRadius: 4,
        fontFamily: 'inherit',
        overflow: 'hidden',
    },
    toolbar: {
        alignItems: 'center',
        background: '#f6f6f9',
        borderBottom: '1px solid #dcdce4',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        padding: '6px 8px',
    },
    btn: {
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1,
        padding: '4px 8px',
    },
    btnActive: {
        background: '#fff',
        border: '1px solid #dcdce4',
        color: '#4945ff',
    },
    hint: {
        color: '#8e8ea0',
        fontSize: 11,
        marginLeft: 'auto',
    },
    content: {
        minHeight: 200,
        padding: '12px 14px',
    },
};
const proseMirrorCss = `
  .ProseMirror { outline: none; }
  .ProseMirror p { margin: 0 0 0.75em; }
  .ProseMirror h2 { font-size: 1.25em; font-weight: 800; margin: 1em 0 0.4em; }
  .ProseMirror h3 { font-size: 1.1em; font-weight: 800; margin: 0.8em 0 0.3em; }
  .ProseMirror blockquote { border-left: 3px solid #22c55e; margin: 0.5em 0; padding: 4px 12px; color: #52525b; }
  .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
  .ProseMirror .mention {
    background: #f0fdf4;
    border-radius: 4px;
    color: #166534;
    font-weight: 600;
    padding: 1px 4px;
    cursor: default;
  }
`;
