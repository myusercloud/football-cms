import React, { useRef, useState } from 'react'
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import { MentionList, type MentionItem, type MentionListHandle } from './MentionList'

// Strapi v5 calls handleChange(fieldPath, value) or handleChange(event)
type StrapiOnChange = (
  eventOrPath: string | { target: { name: string; value: unknown; type?: string } },
  value?: unknown
) => void

interface Props {
  value?: string | null
  onChange?: StrapiOnChange
  disabled?: boolean
  name?: string
  attribute?: Record<string, unknown>
  error?: string
  required?: boolean
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
          renderer = new ReactRenderer(MentionList as any, { props, editor: props.editor })
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

// ── Icons ─────────────────────────────────────────────────────────────────────

const icons: Record<string, React.ReactElement> = {
  undo: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6"/><path d="M3 13C5 7 10 4 16 6a9 9 0 0 1 5 7"/>
    </svg>
  ),
  redo: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6"/><path d="M21 13C19 7 14 4 8 6a9 9 0 0 0-5 7"/>
    </svg>
  ),
  bold: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
    </svg>
  ),
  italic: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>
    </svg>
  ),
  underline: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/>
    </svg>
  ),
  strike: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/>
    </svg>
  ),
  h2: (
    <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 12h8"/><path d="M4 6v12"/><path d="M12 6v12"/><path d="M21 18h-4c0-4 4-3 4-6a2 2 0 0 0-4 0"/>
    </svg>
  ),
  h3: (
    <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 12h8"/><path d="M4 6v12"/><path d="M12 6v12"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 16.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/>
    </svg>
  ),
  quote: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
    </svg>
  ),
  hr: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="3" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  ul: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
      <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  ol: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
      <text x="2" y="9" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">1.</text>
      <text x="2" y="15" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">2.</text>
      <text x="2" y="21" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">3.</text>
    </svg>
  ),
  link: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  unlink: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      <line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  ),
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({
  editor,
  onLinkClick,
}: {
  editor: ReturnType<typeof useEditor>
  onLinkClick: () => void
}) {
  if (!editor) return null

  const btn = (
    key: string,
    icon: React.ReactElement,
    action: () => void,
    active?: boolean,
    title?: string,
  ) => (
    <button
      key={key}
      type="button"
      onClick={action}
      title={title ?? key}
      style={{ ...s.btn, ...(active ? s.btnActive : {}) }}
    >
      {icon}
    </button>
  )

  const sep = (key: string) => <span key={key} style={s.sep} aria-hidden="true" />

  return (
    <div style={s.toolbar}>
      {btn('undo',  icons.undo,  () => editor.chain().focus().undo().run(),  false, 'Undo (Ctrl+Z)')}
      {btn('redo',  icons.redo,  () => editor.chain().focus().redo().run(),  false, 'Redo (Ctrl+Y)')}
      {sep('s1')}
      {btn('bold',      icons.bold,      () => editor.chain().focus().toggleBold().run(),      editor.isActive('bold'),      'Bold (Ctrl+B)')}
      {btn('italic',    icons.italic,    () => editor.chain().focus().toggleItalic().run(),    editor.isActive('italic'),    'Italic (Ctrl+I)')}
      {btn('underline', icons.underline, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Underline (Ctrl+U)')}
      {btn('strike',    icons.strike,    () => editor.chain().focus().toggleStrike().run(),    editor.isActive('strike'),    'Strikethrough')}
      {sep('s2')}
      {btn('h2', icons.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Heading 2')}
      {btn('h3', icons.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), 'Heading 3')}
      {btn('quote', icons.quote, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), 'Blockquote')}
      {btn('hr',    icons.hr,    () => editor.chain().focus().setHorizontalRule().run(), false, 'Horizontal rule')}
      {sep('s3')}
      {btn('ul', icons.ul, () => editor.chain().focus().toggleBulletList().run(),  editor.isActive('bulletList'),  'Bullet list')}
      {btn('ol', icons.ol, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Numbered list')}
      {sep('s4')}
      {btn('link',   icons.link,   onLinkClick,                                          editor.isActive('link'), 'Insert link')}
      {editor.isActive('link') && btn('unlink', icons.unlink, () => editor.chain().focus().unsetLink().run(), false, 'Remove link')}
      <span style={s.hint}>@ to mention</span>
    </div>
  )
}

// ── Link dialog ───────────────────────────────────────────────────────────────

function LinkDialog({
  url,
  onChange,
  onApply,
  onClose,
}: {
  url: string
  onChange: (v: string) => void
  onApply: () => void
  onClose: () => void
}) {
  return (
    <div style={s.linkBar}>
      <span style={s.linkLabel}>URL</span>
      <input
        autoFocus
        type="url"
        placeholder="https://example.com"
        value={url}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onApply(); if (e.key === 'Escape') onClose() }}
        style={s.linkInput}
      />
      <button type="button" onClick={onApply} style={s.linkApply}>Apply</button>
      <button type="button" onClick={onClose} style={s.linkClose} title="Cancel">✕</button>
    </div>
  )
}

// ── Word count ────────────────────────────────────────────────────────────────

function WordCount({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null
  const text = editor.getText()
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length
  return (
    <div style={s.footer}>
      {words} word{words !== 1 ? 's' : ''} · {chars} char{chars !== 1 ? 's' : ''}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RichBodyInput({ value, onChange, disabled, name }: Props) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl]   = useState('')
  const lastJson = useRef<string>('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      MentionExtension,
    ],
    editable: !disabled,
    content: (() => {
      if (!value) return ''
      try { return JSON.parse(value) } catch { return value }
    })(),
    onUpdate({ editor }) {
      const json = JSON.stringify(editor.getJSON())
      if (json !== lastJson.current) {
        lastJson.current = json
        // Strapi v5: call as (fieldPath, value) so handleChange routes it correctly
        onChange?.(name ?? 'content', json)
      }
    },
  })

  const openLink = () => {
    setLinkUrl(editor?.getAttributes('link').href ?? '')
    setLinkOpen(true)
  }

  const applyLink = () => {
    if (!editor) return
    const trimmed = linkUrl.trim()
    if (trimmed) {
      editor.chain().focus().setLink({ href: trimmed }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setLinkOpen(false)
    setLinkUrl('')
  }

  return (
    <div style={s.wrap}>
      <Toolbar editor={editor} onLinkClick={openLink} />
      {linkOpen && (
        <LinkDialog
          url={linkUrl}
          onChange={setLinkUrl}
          onApply={applyLink}
          onClose={() => setLinkOpen(false)}
        />
      )}
      <EditorContent editor={editor} style={s.content} />
      <WordCount editor={editor} />
      <style>{proseMirrorCss}</style>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
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
    alignItems: 'center',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 4,
    color: '#32324d',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    lineHeight: 1,
    padding: '5px 6px',
    transition: 'background 0.1s, border-color 0.1s',
  } as React.CSSProperties,
  btnActive: {
    background: '#fff',
    border: '1px solid #dcdce4',
    color: '#4945ff',
  },
  sep: {
    background: '#dcdce4',
    display: 'inline-block',
    height: 18,
    margin: '0 4px',
    width: 1,
  } as React.CSSProperties,
  hint: {
    color: '#8e8ea0',
    fontSize: 11,
    marginLeft: 'auto',
  },
  linkBar: {
    alignItems: 'center',
    background: '#f0f0ff',
    borderBottom: '1px solid #dcdce4',
    display: 'flex',
    gap: 6,
    padding: '6px 10px',
  } as React.CSSProperties,
  linkLabel: {
    color: '#32324d',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  linkInput: {
    border: '1px solid #dcdce4',
    borderRadius: 4,
    flex: 1,
    fontSize: 13,
    outline: 'none',
    padding: '4px 8px',
  } as React.CSSProperties,
  linkApply: {
    background: '#4945ff',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
  },
  linkClose: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
  },
  content: {
    minHeight: 500,
    padding: '14px 16px',
  },
  footer: {
    background: '#f6f6f9',
    borderTop: '1px solid #dcdce4',
    color: '#8e8ea0',
    fontSize: 11,
    padding: '4px 12px',
    textAlign: 'right' as const,
  },
}

const proseMirrorCss = `
  .ProseMirror { outline: none; font-size: 15px; line-height: 1.7; color: #32324d; }
  .ProseMirror > * + * { margin-top: 0.75em; }
  .ProseMirror p { margin: 0; }
  .ProseMirror h2 { font-size: 1.4em; font-weight: 800; letter-spacing: -0.02em; color: #181826; margin: 1.4em 0 0.4em; }
  .ProseMirror h3 { font-size: 1.15em; font-weight: 700; color: #181826; margin: 1.2em 0 0.3em; }
  .ProseMirror blockquote {
    border-left: 3px solid #22c55e;
    margin: 1em 0;
    padding: 6px 14px;
    color: #52525b;
    background: #f0fdf4;
    border-radius: 0 4px 4px 0;
    font-style: italic;
  }
  .ProseMirror ul, .ProseMirror ol { padding-left: 1.6em; margin: 0.75em 0; }
  .ProseMirror li + li { margin-top: 0.3em; }
  .ProseMirror hr { border: none; border-top: 2px solid #e4e4e7; margin: 1.5em 0; }
  .ProseMirror a { color: #4945ff; text-decoration: underline; cursor: pointer; }
  .ProseMirror u { text-underline-offset: 2px; }
  .ProseMirror .mention {
    background: #f0fdf4;
    border-radius: 4px;
    color: #166534;
    font-weight: 600;
    padding: 1px 5px;
    cursor: default;
  }
`
