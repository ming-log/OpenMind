import { useEffect } from "react";
import { XIcon } from "./Icons";

interface ShortcutsModalProps {
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "节点编辑",
    items: [
      { keys: ["Enter"], description: "为选中节点添加同级节点" },
      { keys: ["Tab"], description: "为选中节点添加子节点" },
      { keys: ["Delete"], description: "删除选中节点（或选中的外框）" },
      { keys: ["双击节点"], description: "进入标题编辑" },
      { keys: ["直接输入"], description: "选中节点后输入字符即可编辑标题（占位标题会覆盖，否则追加）" },
      { keys: ["`"], description: "打开选中节点的批注" },
    ],
  },
  {
    title: "复制 / 撤销",
    items: [
      { keys: ["Ctrl", "C"], description: "复制选中节点及其子树" },
      { keys: ["Ctrl", "V"], description: "粘贴为选中节点的子节点" },
      { keys: ["Ctrl", "Z"], description: "撤销上一步" },
      { keys: ["Ctrl", "Y"], description: "重做（也可用 Ctrl+Shift+Z）" },
      { keys: ["Ctrl", "S"], description: "保存当前任务" },
    ],
  },
  {
    title: "确认弹窗",
    items: [
      { keys: ["Enter"], description: "确认删除" },
      { keys: ["Esc"], description: "取消 / 关闭弹窗或批注抽屉" },
    ],
  },
  {
    title: "画布与选择",
    items: [
      { keys: ["空格", "拖拽"], description: "按住空格拖动平移画布" },
      { keys: ["Ctrl", "拖拽"], description: "框选多个节点" },
      { keys: ["Ctrl", "点击"], description: "加选 / 取消选择某个节点" },
      { keys: ["滚轮"], description: "上下平移画布" },
      { keys: ["Ctrl", "滚轮"], description: "以指针为中心缩放" },
    ],
  },
];

export function ShortcutsModal(props: ShortcutsModalProps) {
  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
      }
    }

    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [props]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={props.onClose}>
      <section className="shortcuts-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>快捷键说明</h2>
          <button aria-label="关闭快捷键说明" onClick={props.onClose} type="button"><XIcon /></button>
        </header>
        <div className="shortcuts-grid">
          {SHORTCUT_GROUPS.map((group) => (
            <section className="shortcuts-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.description}>
                    <span className="shortcut-keys">
                      {item.keys.map((key, index) => (
                        <span className="shortcut-key-row" key={key}>
                          {index > 0 ? <span className="shortcut-plus">+</span> : null}
                          <kbd>{key}</kbd>
                        </span>
                      ))}
                    </span>
                    <span className="shortcut-desc">{item.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
