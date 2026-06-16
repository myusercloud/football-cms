import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'

export interface MentionItem {
  id: string
  entityType: string
  entitySlug: string
  entityName: string
  label: string
  href: string
}

interface Props {
  items: MentionItem[]
  command: (item: MentionItem) => void
}

export interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export const MentionList = forwardRef<MentionListHandle, Props>((props, ref) => {
  const [selected, setSelected] = useState(0)

  useEffect(() => setSelected(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + props.items.length) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = props.items[selected]
        if (item) props.command(item)
        return true
      }
      return false
    },
  }))

  if (!props.items.length) return null

  return (
    <div style={styles.list}>
      {props.items.map((item, i) => (
        <button
          key={item.id}
          style={{ ...styles.item, ...(i === selected ? styles.selected : {}) }}
          onMouseEnter={() => setSelected(i)}
          onClick={() => props.command(item)}
        >
          <span style={styles.badge(item.entityType)}>{item.entityType}</span>
          {item.entityName}
        </button>
      ))}
    </div>
  )
})

MentionList.displayName = 'MentionList'

const styles = {
  list: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    maxHeight: 260,
    minWidth: 220,
    overflowY: 'auto' as const,
    padding: 4,
    zIndex: 9999,
  },
  item: {
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    fontSize: 13,
    gap: 6,
    padding: '6px 10px',
    textAlign: 'left' as const,
    width: '100%',
  },
  selected: {
    background: '#f0fdf4',
  },
  badge: (type: string) => ({
    background: type === 'player' ? '#dcfce7' : '#dbeafe',
    borderRadius: 3,
    color: type === 'player' ? '#166534' : '#1e40af',
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 5px',
    textTransform: 'uppercase' as const,
  }),
}
