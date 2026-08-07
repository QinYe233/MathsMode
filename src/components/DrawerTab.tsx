export function DrawerTab({ onClick }: { onClick: () => void }) {
  return (
    <button className="drawer-tab" onClick={onClick} title="展开函数面板">
      函数图像
    </button>
  );
}
