// CodeMirrorエディターのテーマ設定を管理するモジュール
import { Compartment, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import type { Theme } from '~/types/theme.js';
import type { EditorSettings } from './CodeMirrorEditor.js';

// ダークテーマのベース設定
export const darkTheme = EditorView.theme({}, { dark: true });

// テーマの動的な切り替えを管理するCompartment
export const themeSelection = new Compartment();

// テーマと設定に基づいてエディター拡張を生成する関数
export function getTheme(theme: Theme, settings: EditorSettings = {}): Extension {
  return [
    getEditorTheme(settings),
    theme === 'dark' ? themeSelection.of([getDarkTheme()]) : themeSelection.of([getLightTheme()]),
  ];
}

// テーマの再設定を行う関数
export function reconfigureTheme(theme: Theme) {
  return themeSelection.reconfigure(theme === 'dark' ? getDarkTheme() : getLightTheme());
}

// エディター設定に基づいてテーマ設定を生成する関数
function getEditorTheme(settings: EditorSettings) {
  return EditorView.theme({
    // エディター全体の基本設定
    '&': {
      fontSize: settings.fontSize ?? '12px',
    },
    // エディター本体のスタイル
    '&.cm-editor': {
      height: '100%',
      background: 'var(--cm-backgroundColor)',
      color: 'var(--cm-textColor)',
    },
    // カーソルのスタイル
    '.cm-cursor': {
      borderLeft: 'var(--cm-cursor-width) solid var(--cm-cursor-backgroundColor)',
    },
    // スクロール領域のスタイル
    '.cm-scroller': {
      lineHeight: '1.5',
      '&:focus-visible': {
        outline: 'none',
      },
    },
    // 各行のスタイル
    '.cm-line': {
      padding: '0 0 0 4px',
    },
    // フォーカス時の選択範囲のスタイル
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'var(--cm-selection-backgroundColorFocused) !important',
      opacity: 'var(--cm-selection-backgroundOpacityFocused, 0.3)',
    },
    // 非フォーカス時の選択範囲のスタイル
    '&:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'var(--cm-selection-backgroundColorBlured)',
      opacity: 'var(--cm-selection-backgroundOpacityBlured, 0.3)',
    },
    // 対応する括弧のハイライト
    '&.cm-focused > .cm-scroller .cm-matchingBracket': {
      backgroundColor: 'var(--cm-matching-bracket)',
    },
    // アクティブな行のハイライト
    '.cm-activeLine': {
      background: 'var(--cm-activeLineBackgroundColor)',
    },
    // 行番号ガターのスタイル
    '.cm-gutters': {
      background: 'var(--cm-gutter-backgroundColor)',
      borderRight: 0,
      color: 'var(--cm-gutter-textColor)',
    },
    '.cm-gutter': {
      // 行番号のスタイル設定
      '&.cm-lineNumbers': {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: settings.gutterFontSize ?? settings.fontSize ?? '12px',
        minWidth: '40px',
      },
      // アクティブな行の行番号スタイル
      '& .cm-activeLineGutter': {
        background: 'transparent',
        color: 'var(--cm-gutter-activeLineTextColor)',
      },
      // コードフォールディングアイコンのスタイル
      '&.cm-foldGutter .cm-gutterElement > .fold-icon': {
        cursor: 'pointer',
        color: 'var(--cm-foldGutter-textColor)',
        transform: 'translateY(2px)',
        '&:hover': {
          color: 'var(--cm-foldGutter-textColorHover)',
        },
      },
    },
    // コードフォールディング関連のスタイル
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px',
    },
    // オートコンプリート候補のスタイル
    '.cm-tooltip-autocomplete > ul > li': {
      minHeight: '18px',
    },
    // 検索パネルのスタイル設定
    '.cm-panel.cm-search label': {
      marginLeft: '2px',
      fontSize: '12px',
    },
    '.cm-panel.cm-search .cm-button': {
      fontSize: '12px',
    },
    '.cm-panel.cm-search .cm-textfield': {
      fontSize: '12px',
    },
    '.cm-panel.cm-search input[type=checkbox]': {
      position: 'relative',
      transform: 'translateY(2px)',
      marginRight: '4px',
    },
    // パネル全般のスタイル
    '.cm-panels': {
      borderColor: 'var(--cm-panels-borderColor)',
    },
    '.cm-panels-bottom': {
      borderTop: '1px solid var(--cm-panels-borderColor)',
      backgroundColor: 'transparent',
    },
    // 検索パネルの詳細スタイル
    '.cm-panel.cm-search': {
      background: 'var(--cm-search-backgroundColor)',
      color: 'var(--cm-search-textColor)',
      padding: '8px',
    },
    // 検索ボタンのスタイル
    '.cm-search .cm-button': {
      background: 'var(--cm-search-button-backgroundColor)',
      borderColor: 'var(--cm-search-button-borderColor)',
      color: 'var(--cm-search-button-textColor)',
      borderRadius: '4px',
      '&:hover': {
        color: 'var(--cm-search-button-textColorHover)',
      },
      '&:focus-visible': {
        outline: 'none',
        borderColor: 'var(--cm-search-button-borderColorFocused)',
      },
      '&:hover:not(:focus-visible)': {
        background: 'var(--cm-search-button-backgroundColorHover)',
        borderColor: 'var(--cm-search-button-borderColorHover)',
      },
      '&:hover:focus-visible': {
        background: 'var(--cm-search-button-backgroundColorHover)',
        borderColor: 'var(--cm-search-button-borderColorFocused)',
      },
    },
    // 検索パネルの閉じるボタンのスタイル
    '.cm-panel.cm-search [name=close]': {
      top: '6px',
      right: '6px',
      padding: '0 6px',
      fontSize: '1rem',
      backgroundColor: 'var(--cm-search-closeButton-backgroundColor)',
      color: 'var(--cm-search-closeButton-textColor)',
      '&:hover': {
        'border-radius': '6px',
        color: 'var(--cm-search-closeButton-textColorHover)',
        backgroundColor: 'var(--cm-search-closeButton-backgroundColorHover)',
      },
    },
    // 検索入力フィールドのスタイル
    '.cm-search input': {
      background: 'var(--cm-search-input-backgroundColor)',
      borderColor: 'var(--cm-search-input-borderColor)',
      color: 'var(--cm-search-input-textColor)',
      outline: 'none',
      borderRadius: '4px',
      '&:focus-visible': {
        borderColor: 'var(--cm-search-input-borderColorFocused)',
      },
    },
    // ツールチップのスタイル
    '.cm-tooltip': {
      background: 'var(--cm-tooltip-backgroundColor)',
      border: '1px solid transparent',
      borderColor: 'var(--cm-tooltip-borderColor)',
      color: 'var(--cm-tooltip-textColor)',
    },
    // オートコンプリートツールチップの選択項目スタイル
    '.cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': {
      background: 'var(--cm-tooltip-backgroundColorSelected)',
      color: 'var(--cm-tooltip-textColorSelected)',
    },
    // 検索マッチのハイライトスタイル
    '.cm-searchMatch': {
      backgroundColor: 'var(--cm-searchMatch-backgroundColor)',
    },
    // 読み取り専用時のツールチップスタイル
    '.cm-tooltip.cm-readonly-tooltip': {
      padding: '4px',
      whiteSpace: 'nowrap',
      backgroundColor: 'var(--bolt-elements-bg-depth-2)',
      borderColor: 'var(--bolt-elements-borderColorActive)',
      '& .cm-tooltip-arrow:before': {
        borderTopColor: 'var(--bolt-elements-borderColorActive)',
      },
      '& .cm-tooltip-arrow:after': {
        borderTopColor: 'transparent',
      },
    },
  });
}

// ライトテーマを取得する関数
function getLightTheme() {
  return vscodeLight;
}

// ダークテーマを取得する関数
function getDarkTheme() {
  return vscodeDark;
}
