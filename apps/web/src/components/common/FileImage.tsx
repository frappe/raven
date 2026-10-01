import type { ImgHTMLAttributes } from "react"
import { useFileSrc } from "@hooks/useFileSrc"

/** <img> for a site file; use it where a hook cannot be called (lists). */
export const FileImage = ({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} src={useFileSrc(src)} />
