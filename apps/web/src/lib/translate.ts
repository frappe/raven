import { createElement, Fragment, type ReactNode } from "react";

function _(txt: string, replace?: string[], context = null) {
    if (!txt) return txt;
    if (typeof txt != "string") return txt;

    let translated_text = "";

    const key = txt; // txt.replace(/\n/g, "");
    if (window.frappe) {
        if (context) {
            translated_text = window.frappe._messages?.[`${key}:${context}`];
        }

        if (!translated_text) {
            translated_text = window.frappe?._messages?.[key] || txt;
        }

    } else {
        translated_text = txt;
    }

    if (replace && typeof replace === "object") {
        translated_text = format(translated_text, replace);
    }
    return translated_text;
};

function format(str: string, args: string[]) {
    if (str == undefined) return str;

    let unkeyed_index = 0;
    return str.replace(
        /\{(\w*)\}/g,
        function (match, key) {
            if (key === "") {
                key = unkeyed_index;
                unkeyed_index++;
            }
            if (key == +key) {
                return args[key] ?? match;
            }
            return ""
        }
    );
}

/**
 * Puts React elements (a link, a name in bold, code) at the `{0}`, `{1}` placeholders of an
 * already translated sentence. Pass `_("…")` in, not the English: the string extractor only
 * finds `_()` calls. Keeping the whole sentence as one string lets each language order it.
 */
export function withElements(translated: string, elements: ReactNode[]): ReactNode[] {
    return translated.split(/\{(\d+)\}/).map((part, index) =>
        index % 2 === 1 ? createElement(Fragment, { key: index }, elements[Number(part)]) : part
    );
}

export default _;