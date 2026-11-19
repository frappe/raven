import { Component, type ReactNode } from "react"

interface PickerBoundaryProps {
    onError: () => void
    children: ReactNode
}

/** Keeps a failed picker chunk local: renders nothing and reports the failure. */
export class PickerBoundary extends Component<PickerBoundaryProps, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    componentDidCatch(error: Error) {
        console.error(error)
        this.props.onError()
    }
    render() { return this.state.failed ? null : this.props.children }
}
