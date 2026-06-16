import React, { useCallback, useRef } from 'react'
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { MentionList, type MentionItem, type MentionListHandle } from './MentionList'

// ── Strapi custom field Input receives `value` (string | null) and `onChange` ──

interface Props {
  value?: string | null
  onChange?: (value: string) => void
  disabled?: boolean
  name?: string
}

// ── Suggestion config ─────────────────────────────────────────────────────────

function buildSuggestion() {
  return {
    char: '@',
    allowSpaces: false,
    minLength: 1,

    items: async ({ query }: { query: string }): Promise<MentionItem[]> => {
      if (!query) return []
      try {
        const res = await fetch(`/api/rich-body/search?q=${encodeURIComponent(query)}`)
        if (!res.ok) return []
        return res.json()
      } catch {
        return []
      }
    },

    render: () => {
      let renderer: ReactRenderer<MentionListHandle, any>
      let wrapper: HTMLDivElement
      let rect: DOMRect | null = null

      const reposition = () => {
        if (!wrapper || !rect) return
        wrapper.style.top  = `${rect.bottom + window.scrollY + 4}px`
        wrapper.style.left = `${rect.left + window.scrollX}px`
      }

      return {
        onStart(props: any) {
          rect = props.clientRect?.()

          wrapper = document.createElement('div')
          wrapper.style.cssText = 'position:absolute;z-index:9999'
          document.body.appendChild(wrapper)
          reposition()

          renderer = new ReactRenderer(MentionList as any, {
            props,
            editor: props.editor,
          })
          wrapper.appendChild(renderer.element)
        },

        onUpdate(props: any) {
          rect = props.clientRect?.()
          reposition()
          renderer.updateProps(props)
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            wrapper?.remove()
            renderer?.destroy()
            return true
          }
          return renderer.ref?.onKeyDown(props.event) ?? false
        },

        onExit() {
          wrapper?.remove()
          renderer?.destroy()
        },
      }
    },
  }
}

// ── MentionExtension ──────────────────────────────────────────────────────────

const MentionExtension = Mention.configure({
  // Store entityType, entitySlug, entityName alongside the default `id` attr
  addAttributes() {
    return {
      id:         { default: null },
      entityType: { default: null },
      entitySlug: { default: null },
      entityName: { default: null },
      href:       { default: null },
    }
  },

  renderLabel({ node }) {
    return `@${node.attrs.entityName ?? node.attrs.id ?? ''}`
  },

  suggestion: buildSuggestion(),
})

// ── Editor ────────────────────────────────────────────────────────────────────

export function RichBodyInput({ value, onChange, disabled }: Props) {
  const lastJson = useRef<string>('')

  const editor = useEditor({
    extensions: [StarterKit, MentionExtension],
    editable: !disabled,
    content: (() => {
      if (!value) return ''
      try { return JSON.parse(value) } catch { return value }
    })(),
    onUpdate({ editor }) {
      const json = JSON.stringify(editor.getJSON())
      if (json !== lastJson.current) {
        lastJson.current = json
        onChange?.(json)
      }
    },
  })

  return (
    <div style={editorStyles.wrap}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} style={editorStyles.content} />
      <style>{proseMirrorCss}</style>
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const btn = (label: string, action: () => void, active?: boolean) => (
    <button
      key={label}
      type="button"
      onClick={action}
      style={{ ...editorStyles.btn, ...(active ? editorStyles.btnActive : {}) }}
      title={label}
    >
      {label}
    </button>
  )

  return (
    <div style={editorStyles.toolbar}>
      {btn('B',  () => editor.chain().focus().toggleBold().run(),      editor.isActive('bold'))}
      {btn('I',  () => editor.chain().focus().toggleItalic().run(),    editor.isActive('italic'))}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
      {btn('"',  () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {btn('•',  () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('1.', () => editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList'))}
      <span style={editorStyles.hint}>Type @ to mention a player or club</span>
    </div>
  )
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
    flexWrap: 'wrap' as const,
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
}

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
`
