import React from 'react';
import { motion } from 'framer-motion';
import { Package, Download, Code2 } from 'lucide-react';

interface ImportVisualizerProps {
  lineContent: string;
}

export default function ImportVisualizer({ lineContent }: ImportVisualizerProps) {
  const isImport = lineContent.includes('import') || lineContent.includes('#include');
  const isClass = lineContent.includes('class ');

  let title = 'Code Declaration';
  let Icon = Code2;
  let colorClass = 'text-blue-500 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
  let description = 'Loading definition into environment';

  if (isImport) {
    title = 'Library Import';
    Icon = Package;
    colorClass = 'text-emerald-500 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
    description = 'Loading external package/library';
  } else if (isClass) {
    title = 'Class Definition';
    Icon = Code2;
    colorClass = 'text-purple-500 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30';
    description = 'Defining class structure';
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full h-full">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden max-w-md w-full"
      >
        <div className="p-8 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-4 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-zinc-700 rounded-full opacity-50 blur-md"
            />
            <div className={`relative p-4 rounded-full ${colorClass} ring-4 ring-white dark:ring-zinc-800 shadow-xl`}>
              <Icon className="w-12 h-12" />
            </div>
            
            {isImport && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="absolute -top-2 -right-2 bg-white dark:bg-zinc-800 p-1.5 rounded-full shadow-lg border border-slate-200 dark:border-zinc-700"
              >
                <Download className="w-5 h-5 text-slate-400" />
              </motion.div>
            )}
          </div>
          
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 mb-2">
            {title}
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">
            {description}
          </p>

          <div className="w-full bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-slate-100 dark:border-zinc-700/50">
            <code className="text-sm font-mono text-slate-700 dark:text-zinc-300 break-all">
              {lineContent}
            </code>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
