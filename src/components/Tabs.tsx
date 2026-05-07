import { CircleDot, ListIcon, GearIcon } from "./icons";

export type TabId = "record" | "history" | "settings";

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

const TABS: { id: TabId; label: string; Icon: () => JSX.Element }[] = [
  { id: "record", label: "Record", Icon: CircleDot },
  { id: "history", label: "History", Icon: ListIcon },
  { id: "settings", label: "Settings", Icon: GearIcon },
];

export function Tabs({ active, onChange }: Props) {
  return (
    <div className="tabstrip">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`tabstrip-tab ${isActive ? "tabstrip-tab-active" : ""}`}
          >
            <span className="tabstrip-ic">
              <Icon />
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
