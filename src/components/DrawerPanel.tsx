import { useRef } from 'react';
import type { FunctionAnalysis, VectorDef } from '../types';
import { GraphPanel } from './GraphPanel';

interface Props {
  analyses: FunctionAnalysis[];
  vectors: VectorDef[];
  width: number;
  onResize: (w: number) => void;
  onClose: () => void;
  onResizeEnd?: () => void;
  onClear: () => void;
  onAddVector: (input: string) => string | null;
  highlightedExpr?: string | null;
}

export function DrawerPanel({ analyses, vectors, width, onResize, onClose, onResizeEnd, onClear, onAddVector, highlightedExpr }: Props) {
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startW: width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    onResize(dragRef.current.startW - dx);
  };
  const onPointerUp = () => {
    dragRef.current = null;
    onResizeEnd?.();
  };

  return (
    <div className="drawer-panel">
      <div
        className="drawer-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="拖拽调整宽度"
      />
      <div className="right-panel-head">
        <span>函数图像与特性</span>
        <button className="icon-btn" onClick={onClose} aria-label="收起函数面板" title="收起">
          »
        </button>
      </div>
      <GraphPanel
        analyses={analyses}
        vectors={vectors}
        onClear={onClear}
        onAddVector={onAddVector}
        highlightedExpr={highlightedExpr}
      />
    </div>
  );
}

export function DrawerTab({ onClick }: { onClick: () => void }) {
  return (
    <button className="drawer-tab" onClick={onClick} title="展开函数面板">
      函数图像
    </button>
  );
}
