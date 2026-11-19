let context: AudioContext | null = null

/** One context for the app. iOS keeps a context suspended unless resumed in a user gesture. */
export const getAudioContext = (): AudioContext => {
    context ??= new AudioContext()
    return context
}

/** Call synchronously inside the click/tap that starts recording. */
export const unlockAudioContext = () => {
    void getAudioContext().resume()
}

/** An idle running context still renders silence; suspend it when recording ends. */
export const suspendAudioContext = () => {
    if (context?.state === "running") void context.suspend()
}
