'use client';

import React, { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, Range as MonacoRange } from 'monaco-editor';
import { useTheme } from 'next-themes';

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (value: string | undefined) => void;
  activeLine?: number;
}

export default function CodeEditor({ code, language, onChange, activeLine }: CodeEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);
  const monacoRef = useRef<any>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection();

    // Define a custom dark theme
    monaco.editor.defineTheme('algoviz-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0B0F19',
        'editor.lineHighlightBackground': '#1e293b50',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#94a3b8',
      },
    });
  };

  useEffect(() => {
    if (!editorRef.current || !decorationsRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;

    if (activeLine && activeLine > 0) {
      decorationsRef.current.set([{
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: 'active-line-highlight',
          glyphMarginClassName: 'active-line-glyph',
        },
      }]);
      editorRef.current.revealLineInCenterIfOutsideViewport(activeLine);
    } else {
      decorationsRef.current.set([]);
    }
  }, [activeLine]);

  return (
    <Editor
      height="100%"
      language={language}
      value={code}
      onChange={onChange}
      onMount={handleMount}
      theme={theme === 'dark' ? 'algoviz-dark' : 'light'}
      loading={
        <div className="flex items-center justify-center h-full text-zinc-600">
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="ml-2 text-sm font-mono">Loading editor...</span>
          </div>
        </div>
      }
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        wordWrap: 'on',
        padding: { top: 16, bottom: 80 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'gutter',
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        glyphMargin: true,
        folding: true,
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
