/**
 * Row of quick-action buttons (upload a file, request a consultation) shown
 * under the composer on the empty assistant page. Presentational — receives its
 * handlers as props.
 */
type AssistantQuickActionsProps = {
  isEn: boolean;
  onUpload: () => void;
  onRequest: () => void;
};

export default function AssistantQuickActions({ isEn, onUpload, onRequest }: AssistantQuickActionsProps) {
  return (
    <div className="mt-4 flex flex-nowrap justify-start gap-2 overflow-x-auto pb-1 md:mt-5 md:flex-wrap md:justify-center md:gap-3">
      <button
        onClick={onUpload}
        className="ui-btn ui-btn-ghost rounded-full px-4 py-2 text-sm shadow-sm"
      >
        {isEn ? "Upload file or image" : "آپلود فایل یا عکس"}
      </button>

      <button
        onClick={onRequest}
        className="ui-btn ui-btn-ghost rounded-full px-4 py-2 text-sm shadow-sm"
      >
        {isEn ? "Request consultation" : "درخواست مشاوره"}
      </button>
    </div>
  );
}
