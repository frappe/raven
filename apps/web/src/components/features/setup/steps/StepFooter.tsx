/** The step's main button, full width, held at the bottom of the step. The page keeps it still while the step changes. */
export const StepFooter = ({ children }: { children: React.ReactNode }) => (
    // Taller on phones, for a bigger touch target.
    <div data-slot="step-footer" className="mt-auto pt-4 [&>button]:h-10 [&>button]:w-full md:[&>button]:h-8">
        {children}
    </div>
)
