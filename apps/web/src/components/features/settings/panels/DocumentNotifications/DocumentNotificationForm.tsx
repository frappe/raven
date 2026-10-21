import { BellIcon, UsersIcon, WorkflowIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import _ from "@lib/translate"
import { DocumentNotificationDetailsTab } from "./DocumentNotificationDetailsTab"
import { DocumentNotificationRecipientsTab } from "./DocumentNotificationRecipientsTab"
import { DocumentNotificationConditionTab } from "./DocumentNotificationConditionTab"

/** Create/edit form for a Raven Document Notification — Details / Recipients / Conditions tabs. */
export const DocumentNotificationForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <Tabs defaultValue="details" className="flex flex-col flex-1 min-h-0">
        <TabsList>
            <TabsTrigger value="details"><BellIcon /> {_("Details")}</TabsTrigger>
            <TabsTrigger value="recipients"><UsersIcon /> {_("Recipients")}</TabsTrigger>
            <TabsTrigger value="condition"><WorkflowIcon /> {_("Conditions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="pt-4">
            <DocumentNotificationDetailsTab isEdit={isEdit} />
        </TabsContent>
        <TabsContent value="recipients" className="pt-4">
            <DocumentNotificationRecipientsTab />
        </TabsContent>
        <TabsContent value="condition" className="pt-4">
            <DocumentNotificationConditionTab />
        </TabsContent>
    </Tabs>
)

export default DocumentNotificationForm
