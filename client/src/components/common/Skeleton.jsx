import React from 'react';

export default function Skeleton({
  variant = 'text', // 'text' | 'rect' | 'circle' | 'table-row'
  className = '',
  count = 1,
  width,
  height,
}) {
  const baseClasses = 'animate-pulse bg-slate-200/80 rounded';

  const variantClasses = {
    text: 'h-4 w-full rounded',
    rect: 'w-full h-24 rounded-lg',
    circle: 'rounded-full w-10 h-10',
    'table-row': 'w-full h-12 rounded border border-slate-100',
  };

  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, idx) => (
        <div
          key={idx}
          className={`${baseClasses} ${variantClasses[variant]} ${className}`}
          style={{
            width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
            height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
          }}
        />
      ))}
    </>
  );
}
