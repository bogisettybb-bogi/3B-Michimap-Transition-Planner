import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function DisclaimersDialog({ isOpen, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-black/50 backdrop:backdrop-blur-sm p-0 m-auto rounded-2xl shadow-2xl border border-border/50 bg-card w-full max-w-2xl text-foreground open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h2 className="text-xl font-display font-bold">Disclaimers & Terms of Use</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
        <section>
          <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
            <span className="bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
            Accuracy / No Warranty
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Effort estimates are indicative and based on inputs provided by the user. 3B Michimap makes no warranty, express or implied, regarding the accuracy, completeness, or fitness of generated outputs for any specific engagement.
          </p>
        </section>

        <section>
          <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
            <span className="bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
            No Commercial Reliance
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Outputs from this tool are intended for internal planning purposes only and should not be submitted to clients or included in formal commercial proposals without independent validation by a qualified SAP professional.
          </p>
        </section>

        <section>
          <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
            <span className="bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
            Acceptable Use
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This tool is intended exclusively for SAP pre-sales and delivery professionals. Unauthorised use, reverse engineering, or redistribution of generated outputs is prohibited.
          </p>
        </section>
      </div>

      <div className="p-6 border-t border-border bg-muted/20 flex justify-end">
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
        >
          I Understand
        </button>
      </div>
    </dialog>
  );
}
