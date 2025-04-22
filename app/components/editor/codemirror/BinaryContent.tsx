// バイナリファイルを開いた際の警告表示コンポーネント
// テキストエディターで表示できないファイルタイプの場合に表示される
export function BinaryContent() {
  return (
    <div className="flex items-center justify-center absolute inset-0 z-10 text-sm bg-tk-elements-app-backgroundColor text-tk-elements-app-textColor">
      File format cannot be displayed.
    </div>
  );
}
