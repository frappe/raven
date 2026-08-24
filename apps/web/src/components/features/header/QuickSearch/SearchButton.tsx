import { commandMenuOpenAtom } from "@components/features/cmdk/atoms";
import { Search, SearchIcon } from "lucide-react";
import _ from "@lib/translate";
import { useSetAtom } from "jotai";
import { Kbd, KbdGroup } from "@components/ui/kbd";
import { KeyboardMetaKeyIcon } from "@components/ui/keyboard-keys";
import { Button } from "@components/ui/button";

const SearchButton = () => {
    const setOpen = useSetAtom(commandMenuOpenAtom)

    return (
        <div className="lg:w-130 md:w-72 w-full z-50 cursor-pointer">

            <button
                className="flex justify-between items-center px-2 bg-surface-gray-2 border-none h-7 w-full rounded-sm text-sm text-left text-ink-gray-4 cursor-pointer"
                onClick={() => setOpen(true)}
            >
                <div className="flex items-center gap-2">
                    <Search className="size-4 text-ink-gray-4" />
                    {_("Search")}
                </div>
                <KbdGroup>
                    <Kbd className="text-ink-gray-4 font-normal items-center gap-0 flex justify-center">
                        <KeyboardMetaKeyIcon />K
                    </Kbd>
                </KbdGroup>
            </button>
        </div>
    )
}

export const MobileSearchButton = () => {

    const setOpen = useSetAtom(commandMenuOpenAtom)
    return <div className="md:hidden flex items-center justify-center"><Button
        variant="ghost"
        size="lg"
        isIconButton
        onClick={() => setOpen(true)}
        aria-label={_("Command Menu")}
    >
        <SearchIcon />
    </Button>
    </div>
}

SearchButton.displayName = "SearchButton"

export default SearchButton
