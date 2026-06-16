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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MentionList = void 0;
const react_1 = __importStar(require("react"));
exports.MentionList = (0, react_1.forwardRef)((props, ref) => {
    const [selected, setSelected] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => setSelected(0), [props.items]);
    (0, react_1.useImperativeHandle)(ref, () => ({
        onKeyDown(event) {
            if (event.key === 'ArrowUp') {
                setSelected((s) => (s - 1 + props.items.length) % props.items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelected((s) => (s + 1) % props.items.length);
                return true;
            }
            if (event.key === 'Enter') {
                const item = props.items[selected];
                if (item)
                    props.command(item);
                return true;
            }
            return false;
        },
    }));
    if (!props.items.length)
        return null;
    return (<div style={styles.list}>
      {props.items.map((item, i) => (<button key={item.id} style={{ ...styles.item, ...(i === selected ? styles.selected : {}) }} onMouseEnter={() => setSelected(i)} onClick={() => props.command(item)}>
          <span style={styles.badge(item.entityType)}>{item.entityType}</span>
          {item.entityName}
        </button>))}
    </div>);
});
exports.MentionList.displayName = 'MentionList';
const styles = {
    list: {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxHeight: 260,
        minWidth: 220,
        overflowY: 'auto',
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
        textAlign: 'left',
        width: '100%',
    },
    selected: {
        background: '#f0fdf4',
    },
    badge: (type) => ({
        background: type === 'player' ? '#dcfce7' : '#dbeafe',
        borderRadius: 3,
        color: type === 'player' ? '#166534' : '#1e40af',
        fontSize: 10,
        fontWeight: 700,
        padding: '1px 5px',
        textTransform: 'uppercase',
    }),
};
