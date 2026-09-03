import { Label, ErrorText, HelperText } from '@/components/common/Form'
import { Stack, HStack } from '@/components/layout/Stack'
import { RavenBot } from '@/types/RavenBot/RavenBot'
import useRavenSettings from '@/hooks/fetchers/useRavenSettings'
import { Box, TextField, Checkbox, Text, Separator, Tooltip, Heading, Select, Slider, Code, Callout } from '@radix-ui/themes'
import { useFrappeGetCall } from 'frappe-react-sdk'
import { useFormContext, Controller } from 'react-hook-form'
import { BiInfoCircle } from 'react-icons/bi'

type Props = {}

const AIFeaturesBotForm = (props: Props) => {
    const { register, control, formState: { errors }, watch } = useFormContext<RavenBot>()

    const openAIAssistantID = watch('openai_assistant_id')
    const modelProvider = watch('model_provider')
    const temperature = watch('temperature')
    const top_p = watch('top_p')

    const isLocalLLM = modelProvider === 'Local LLM'
    const isOpenAI = !modelProvider || modelProvider === 'OpenAI'

    return (
        <Stack gap='4'>
            {!isLocalLLM && openAIAssistantID && (
                <Stack maxWidth={'480px'}>
                    <Box>
                        <Label htmlFor='openai_assistant_id'>OpenAI Assistant ID</Label>
                        <TextField.Root
                            id='openai_assistant_id'
                            {...register('openai_assistant_id')}
                            readOnly
                            placeholder="asst_*******************"
                            aria-invalid={errors.openai_assistant_id ? 'true' : 'false'}
                        />
                    </Box>
                    {errors.openai_assistant_id && <ErrorText>{errors.openai_assistant_id?.message}</ErrorText>}
                </Stack>
            )}

            <HStack gap='8'>
                <ModelProviderSelector />
                <ModelSelector />
            </HStack>

            {isOpenAI && <ReasoningEffortSelector />}

            <Separator className='w-full' />

            <Stack maxWidth={'480px'}>
                <Text as="label" size="2">
                    <HStack>
                        <Controller
                            control={control}
                            name='allow_bot_to_write_documents'
                            render={({ field }) => (
                                <Checkbox
                                    checked={field.value ? true : false}
                                    onCheckedChange={(v) => field.onChange(v ? 1 : 0)}
                                />
                            )} />

                        Allow Agent to Write Documents
                    </HStack>
                </Text>
                <HelperText>
                    Checking this will allow the bot to create/update/delete documents in the system.
                </HelperText>
            </Stack>

            <Separator className='w-full' />

            {isOpenAI && (
                <>
                    <HStack gap='8'>
                        <Stack>
                            <Text as="label" size="2">
                                <HStack align='center'>
                                    <Controller
                                        control={control}
                                        name='enable_file_search'
                                        render={({ field }) => (
                                            <Checkbox
                                                checked={field.value ? true : false}
                                                onCheckedChange={(v) => field.onChange(v ? 1 : 0)}
                                            />
                                        )} />
                                    <span>Enable File Search</span>
                                    <Tooltip content='View OpenAI documentation about File Search'>
                                        <a href='https://platform.openai.com/docs/assistants/tools/file-search'
                                            title='View OpenAI documentation about File Search'
                                            aria-label='View OpenAI documentation about File Search'
                                            target='_blank' className='text-gray-11 -mb-1'>
                                            <BiInfoCircle size={16} /></a>
                                    </Tooltip>

                                </HStack>
                            </Text>
                            <HelperText>
                                Enable this if you want the bot to be able to read PDF files and scan them.
                                <br /><br />
                                File search enables the assistant with knowledge from files that you upload.
                                <br />
                                Once a file is uploaded, the assistant automatically decides when to retrieve content based on user requests.
                            </HelperText>
                        </Stack>
                        <Stack>
                            <Text as="label" size="2">
                                <HStack align='center'>
                                    <Controller
                                        control={control}
                                        name='enable_code_interpreter'
                                        render={({ field }) => (
                                            <Checkbox
                                                checked={field.value ? true : false}
                                                onCheckedChange={(v) => field.onChange(v ? 1 : 0)}
                                            />
                                        )} />
                                    <span>Enable Code Interpreter</span>
                                    <Tooltip content='View OpenAI documentation about Code Interpreter'>
                                        <a href='https://platform.openai.com/docs/assistants/tools/code-interpreter'
                                            title='View OpenAI documentation about Code Interpreter'
                                            aria-label='View OpenAI documentation about Code Interpreter'
                                            target='_blank' className='text-gray-11 -mb-1'>
                                            <BiInfoCircle size={16} /></a>
                                    </Tooltip>

                                </HStack>
                            </Text>
                            <HelperText>
                                Enable this if you want the bot to be able to process files like Excel sheets or data from Insights.
                                <br /><br />
                                OpenAI Assistants run code in a sandboxed environment (on OpenAI servers) to do this.
                            </HelperText>
                        </Stack>
                    </HStack>
                    <Separator className='w-full' />
                </>
            )}

            {isLocalLLM && (
                <>
                    <Callout.Root size="1">
                        <Callout.Icon>
                            <BiInfoCircle />
                        </Callout.Icon>
                        <Callout.Text>
                            Currently, code interpreter features are not available for Local LLM providers.
                            These features require OpenAI's infrastructure.
                        </Callout.Text>
                    </Callout.Root>
                    <Stack maxWidth={'480px'}>
                        <Text as="label" size="2">
                            <HStack align='center'>
                                <Controller
                                    control={control}
                                    name='enable_vision_base64'
                                    render={({ field }) => (
                                        <Checkbox
                                            checked={field.value ? true : false}
                                            onCheckedChange={(v) => field.onChange(v ? 1 : 0)}
                                        />
                                    )}
                                />
                                <span>Enable vision (base64 image encoding)</span>
                            </HStack>
                        </Text>
                        <HelperText>
                            When images are sent to this agent, encode them as base64 and include them directly
                            in the request. Enable this for vision-capable models (Ollama, LM Studio, etc.).
                        </HelperText>
                    </Stack>
                </>
            )}

            <Heading as='h5' size='3' className='not-cal' weight='bold'>Advanced</Heading>
            <Stack maxWidth={'560px'}>
                <Text as="label" size="2">
                    <HStack align='center'>
                        <Controller
                            control={control}
                            name='debug_mode'
                            render={({ field }) => (
                                <Checkbox
                                    checked={field.value ? true : false}
                                    onCheckedChange={(v) => field.onChange(v ? 1 : 0)}
                                />
                            )} />
                        <span>Enable Debug Mode</span>
                    </HStack>
                </Text>
                <HelperText>
                    If enabled, stack traces of errors will be sent as messages by the bot during runs.
                    <br />
                    This is helpful when you're testing your bots and want to know where things are going wrong.
                </HelperText>
            </Stack>

            <HStack gap='8' align='start'>
                <Stack maxWidth={'560px'}>
                    <HStack justify='between' align='center'>
                        <Label htmlFor='temperature'>Temperature <Text as='span' color='gray' weight='regular'>(Default: 1)</Text></Label>
                        <Code color='gray' size='2' variant='ghost' weight='regular'>{(temperature ?? 1).toFixed(2)}</Code>
                    </HStack>
                    <Controller control={control} name='temperature' render={({ field }) => (
                        <Slider
                            {...field}
                            color='gray'
                            variant='soft'
                            defaultValue={[1]}
                            className='w-full'
                            value={[field.value ?? 1]}
                            onValueChange={(value) => field.onChange(value[0])}
                            max={2}
                            min={0}
                            step={0.01}
                        />
                    )} />
                    <HelperText>
                        What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
                    </HelperText>
                </Stack>
                <Stack maxWidth={'560px'}>
                    <HStack justify='between' align='center'>
                        <Label htmlFor='top_p'>Top P <Text as='span' color='gray' weight='regular'>(Default: 1)</Text></Label>
                        <Code color='gray' size='2' variant='ghost' weight='regular'>{(top_p ?? 1).toFixed(2)}</Code>
                    </HStack>
                    <Controller control={control} name='top_p' render={({ field }) => (
                        <Slider
                            {...field}
                            color='gray'
                            variant='soft'
                            className='w-full'
                            defaultValue={[1]}
                            value={[field.value ?? 1]}
                            onValueChange={(value) => field.onChange(value[0])}
                            max={1}
                            min={0}
                            step={0.01}
                        />
                    )} />
                    <HelperText>
                        An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.
                        <br /><br />
                        We generally recommend altering this or temperature but not both.
                    </HelperText>
                </Stack>
            </HStack>
        </Stack>
    )
}

const ModelProviderSelector = () => {
    const { control, formState: { errors }, watch } = useFormContext<RavenBot>()
    const { ravenSettings } = useRavenSettings()
    const is_ai_bot = watch('is_ai_bot')

    if (!is_ai_bot) return null

    const hasOpenAI = ravenSettings?.enable_openai_services
    const hasLocalLLM = ravenSettings?.enable_local_llm

    if (!hasOpenAI && !hasLocalLLM) {
        return (
            <Callout.Root color="red" size="1">
                <Callout.Icon>
                    <BiInfoCircle />
                </Callout.Icon>
                <Callout.Text>
                    No AI providers are configured. Please configure OpenAI or Local LLM in AI Settings.
                </Callout.Text>
            </Callout.Root>
        )
    }

    return (
        <Stack width={'480px'}>
            <Box>
                <Label htmlFor='model_provider' isRequired>Model Provider</Label>
                <Controller control={control} name='model_provider'
                    rules={{
                        required: is_ai_bot ? "Please select a model provider" : false
                    }}
                    defaultValue={hasOpenAI ? 'OpenAI' : hasLocalLLM ? 'Local LLM' : 'OpenAI'}
                    render={({ field }) => (
                        <Select.Root
                            value={field.value || (hasOpenAI ? 'OpenAI' : 'Local LLM')}
                            name={field.name}
                            onValueChange={(value) => field.onChange(value)}>
                            <Select.Trigger placeholder='Select Provider' className='w-full' />
                            <Select.Content>
                                {hasOpenAI ? <Select.Item value='OpenAI'>OpenAI</Select.Item> : null}
                                {hasLocalLLM ? <Select.Item value='Local LLM'>Local LLM</Select.Item> : null}
                            </Select.Content>
                        </Select.Root>
                    )} />
            </Box>
            {errors.model_provider && <ErrorText>{errors.model_provider?.message}</ErrorText>}
        </Stack>
    )
}

const ModelSelector = () => {
    const { control, formState: { errors }, watch } = useFormContext<RavenBot>()
    const { ravenSettings } = useRavenSettings()
    const is_ai_bot = watch('is_ai_bot')
    const modelProvider = watch('model_provider')

    // Fetch OpenAI models
    const { data: openaiModels } = useFrappeGetCall('raven.api.ai_features.get_openai_available_models', undefined, modelProvider === 'OpenAI' || !modelProvider ? undefined : null, {
        revalidateOnFocus: false,
        revalidateIfStale: false
    })

    // Fetch Local LLM models
    const { data: localModelData } = useFrappeGetCall<{
        message: {
            success: boolean
            models?: Array<{ id: string }>
        }
    }>('raven.api.ai_features.test_llm_configuration', {
        provider: 'Local LLM',
        api_url: ravenSettings?.local_llm_api_url,
        local_llm_provider: ravenSettings?.local_llm_provider
    }, modelProvider === 'Local LLM' && ravenSettings?.local_llm_api_url ? undefined : null, {
        revalidateOnFocus: false,
        revalidateIfStale: false
    })

    const localModels = localModelData?.message.models?.map(m => m.id) || []

    if (!is_ai_bot) return null

    const models: string[] = modelProvider === 'Local LLM' ? localModels : openaiModels?.message || []
    const defaultModel = modelProvider === 'Local LLM'
        ? (localModels[0] || 'default-model')
        : 'gpt-4o'

    // Filter out empty strings from models
    const validModels = models.filter(model => model && model.trim() !== '')

    return (
        <Stack maxWidth={'480px'}>
            <Box>
                <Label htmlFor='model' isRequired>Model</Label>
                <Controller control={control} name='model'
                    rules={{
                        required: is_ai_bot ? "Please select a model" : false
                    }}
                    defaultValue={defaultModel}
                    render={({ field }) => (
                        <Select.Root
                            value={field.value || defaultModel}
                            name={field.name}
                            onValueChange={(value) => field.onChange(value)}>
                            <Select.Trigger placeholder='Select Model' className='w-full' />
                            <Select.Content>
                                {validModels.length > 0 ? (
                                    validModels.map((model: string) => (
                                        <Select.Item key={model} value={model}>{model}</Select.Item>
                                    ))
                                ) : modelProvider === 'Local LLM' ? (
                                    <Select.Item value="no-models" disabled>No models available</Select.Item>
                                ) : (
                                    <Select.Item value={defaultModel}>{defaultModel}</Select.Item>
                                )}
                            </Select.Content>
                        </Select.Root>
                    )} />
            </Box>
            {errors.model && <ErrorText>{errors.model?.message}</ErrorText>}
            <HelperText>
                {modelProvider === 'Local LLM'
                    ? 'Select a model available on your local LLM server.'
                    : 'The model should be compatible with the OpenAI Assistants API. We recommend using models in the GPT-4 family for best results.'}
            </HelperText>
        </Stack>
    )
}

const ReasoningEffortSelector = () => {
    const { control, watch } = useFormContext<RavenBot>()
    const model = watch('model')
    const is_ai_bot = watch('is_ai_bot')

    if (!model) return null

    if (model.startsWith("o")) {
        return <Stack maxWidth={'480px'}>
            <Box>
                <Label htmlFor='reasoning_effort' isRequired>Reasoning Effort</Label>
                <Controller control={control}
                    rules={{
                        required: model.startsWith("o") && is_ai_bot ? true : false
                    }}
                    defaultValue='medium'
                    name='reasoning_effort' render={({ field }) => (
                        <Select.Root
                            value={field.value || 'medium'}
                            name={field.name}
                            onValueChange={(value) => field.onChange(value)}>
                            <Select.Trigger placeholder='Select Reasoning Effort' className='w-full' />
                            <Select.Content>
                                <Select.Item value='low'>Low</Select.Item>
                                <Select.Item value='medium'>Medium</Select.Item>
                                <Select.Item value='high'>High</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    )} />
            </Box>
            <HelperText>
                The reasoning effort will be used to determine the depth of the reasoning process. This is only applicable for OpenAI's o-series models.
            </HelperText>
        </Stack>
    }
    return null
}

export default AIFeaturesBotForm