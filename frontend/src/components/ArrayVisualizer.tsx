import React from 'react';
import { motion } from 'framer-motion';

export type ElementState = 'default' | 'comparing' | 'sorted';

export interface ArrayElement {
  value: number | string;
  state?: ElementState;
  pointers?: string[];
}

export interface Step {
  id: string | number;
  description: string;
  array: ArrayElement[];
  annotation?: string;
}

export interface ArrayVisualizerProps {
  steps: Step[];
  variant?: 'contiguous' | 'separated';
  pointers?: Record<number, string[]>;
  activeIndices?: number[];
  swapIndices?: [number, number]; // [indexA, indexB] that were swapped
  comparingIndices?: [number, number]; // [indexA, indexB] that are being compared
  sortedBoundary?: number; // Boundary index separating sorted/unsorted
}

export const ArrayVisualizer: React.FC<ArrayVisualizerProps> = ({
  steps,
  variant = 'contiguous',
  pointers,
  activeIndices,
  swapIndices,
  comparingIndices,
  sortedBoundary
}) => {
  // Assume a fixed width for items to calculate SVG and animation offsets
  // w-14 = 56px, plus gaps and borders roughly 64px total per item step.
  const ITEM_WIDTH = 64;
  const ITEM_CENTER = 32;

  const getCellClasses = (idx: number, state: ElementState = 'default', isVariantSeparated: boolean) => {
    let base = "flex items-center justify-center w-14 h-14 font-bold text-lg relative transition-colors duration-300 shadow-sm ";

    if (isVariantSeparated) {
      base += "rounded-md border-[3px] ";
    } else {
      base += "border border-slate-400 dark:border-slate-600 ";
    }

    if (swapIndices && swapIndices.includes(idx)) {
      return base + "bg-purple-500 dark:bg-purple-600/90 text-white border-[3px] !border-purple-300 dark:!border-purple-400 border-solid z-10 scale-105 shadow-purple-500/50 shadow-lg";
    }

    if (activeIndices && activeIndices.includes(idx)) {
      return base + "bg-yellow-300 dark:bg-yellow-500/90 text-black dark:text-white border-[3px] !border-yellow-600 dark:!border-yellow-300 border-dashed z-10 scale-105 shadow-md";
    }

    switch (state) {
      case 'comparing':
        return base + "bg-orange-400 dark:bg-orange-500/80 text-white border-[3px] !border-orange-200 dark:!border-orange-300 border-dashed z-10";
      case 'sorted':
        return base + "bg-emerald-400 dark:bg-emerald-500/90 text-white border-[3px] !border-emerald-200 dark:!border-emerald-300 border-solid z-10";
      case 'default':
      default:
        base += "bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 ";
        if (isVariantSeparated) {
          base += "border-slate-300 dark:border-zinc-600";
        }
        return base;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto font-sans relative">
      {steps.map((step) => {
        const isSeparated = variant === 'separated';

        return (
          <div key={step.id} className="flex flex-col items-center justify-center w-full relative group">

            {/* Step Description */}
            {step.description && (
              <div className="mb-8 p-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 text-center max-w-sm">
                {step.description}
              </div>
            )}

            <div className="w-full max-w-[100vw] overflow-x-auto custom-scrollbar">
              <div className="table mx-auto relative pt-12 pb-16 px-8">

              {/* Array Elements Container */}
              <div className={`flex relative z-10 ${isSeparated ? 'gap-2' : 'shadow-sm rounded-sm'}`}>
                {step.array.map((el, idx) => {
                  const isContiguous = variant === 'contiguous';
                  const isDefault = !el.state || el.state === 'default';
                  const removeRightBorder = isContiguous && isDefault && idx !== step.array.length - 1;

                  // Animation calculation for swaps
                  let initialX = 0;
                  let initialY = 0;
                  if (swapIndices && swapIndices.includes(idx)) {
                    // Element moved from the other index to this index
                    const originalIdx = idx === swapIndices[0] ? swapIndices[1] : swapIndices[0];
                    initialX = (originalIdx - idx) * ITEM_WIDTH;
                    initialY = -30; // Drop in from top
                  }

                  return (
                    <div key={idx} className="relative flex flex-col items-center">

                      {/* Pointers (e.g. i, j) */}
                      {pointers && pointers[idx] && (
                        <div className="absolute -top-12 flex flex-col items-center justify-center whitespace-nowrap z-20">
                          <span className="bg-white dark:bg-zinc-800 px-2 py-0.5 rounded shadow-sm border border-slate-200 dark:border-zinc-700 text-xs font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400">
                            {pointers[idx].join(', ')}
                          </span>
                          <div className="w-0.5 h-3 bg-indigo-300 dark:bg-indigo-500/50 mt-1 rounded-full" />
                        </div>
                      )}

                      <motion.div
                        initial={{ x: initialX, y: initialY, opacity: initialX !== 0 ? 0 : 1 }}
                        animate={{ x: 0, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className={`${getCellClasses(idx, el.state, isSeparated)} ${removeRightBorder ? 'border-r-0' : ''}`}
                      >
                        {el.value}
                      </motion.div>

                      {/* Index and Memory Address Label */}
                      <div className="flex flex-col items-center mt-2.5 gap-1">
                        <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded shadow-sm border border-slate-200/50 dark:border-zinc-700/50">
                          idx: {idx}
                        </span>
                        <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-zinc-400">
                          mem: 0x{((0x7ffee000) + (idx * 4)).toString(16).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparison Arc SVG */}
              {comparingIndices && (
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
                  <path
                    d={`M ${comparingIndices[0] * ITEM_WIDTH + ITEM_CENTER} 20 Q ${(comparingIndices[0] + comparingIndices[1]) * ITEM_WIDTH / 2 + ITEM_CENTER} -20 ${comparingIndices[1] * ITEM_WIDTH + ITEM_CENTER} 20`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="text-orange-400 dark:text-orange-500"
                  />
                  <rect
                    x={(comparingIndices[0] + comparingIndices[1]) * ITEM_WIDTH / 2 + ITEM_CENTER - 15}
                    y="-12"
                    width="30"
                    height="16"
                    rx="8"
                    className="fill-orange-100 dark:fill-orange-900/50 stroke-orange-300 dark:stroke-orange-700"
                  />
                  <text
                    x={(comparingIndices[0] + comparingIndices[1]) * ITEM_WIDTH / 2 + ITEM_CENTER}
                    y="-1"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    className="fill-orange-700 dark:fill-orange-300"
                  >
                    VS
                  </text>
                </svg>
              )}

              {/* Semantic Region Boundaries */}
              {sortedBoundary !== undefined && sortedBoundary > 0 && (
                <div className="absolute -bottom-8 left-0 flex w-full">
                  <div
                    className="flex flex-col items-center border-t-2 border-emerald-400 dark:border-emerald-500/50 pt-1 transition-all"
                    style={{ width: `${sortedBoundary * ITEM_WIDTH}px` }}
                  >
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sorted</span>
                  </div>
                  {sortedBoundary < step.array.length && (
                    <div
                      className="flex flex-col items-center border-t-2 border-slate-300 dark:border-zinc-700 pt-1 transition-all"
                      style={{ width: `${(step.array.length - sortedBoundary) * ITEM_WIDTH}px` }}
                    >
                      <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Unsorted</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
          </div>
        );
      })}
    </div>
  );
};
