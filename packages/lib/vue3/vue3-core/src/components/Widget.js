/**
 * Created by Liu.Jun on 2020/4/23 11:24.
 */

import {
    computed, h, ref, watch
} from 'vue';

import { validateFormDataAndTransformMsg } from '@lljj/vjsf-utils/schema/validate';
import {
    isRootNodePath, path2prop, getPathVal, setPathVal, resolveComponent
} from '@lljj/vjsf-utils/vue3Utils';

export default {
    name: 'Widget',
    props: {
        // 是否同步formData的值，默认表单元素都需要
        // oneOf anyOf 中的select属于formData之外的数据
        isFormData: {
            type: Boolean,
            default: true
        },
        // isFormData = false时需要传入当前 value 否则会通过 curNodePath 自动计算
        curValue: {
            type: null,
            default: 0
        },
        schema: {
            type: Object,
            default: () => ({})
        },
        uiSchema: {
            type: Object,
            default: () => ({})
        },
        errorSchema: {
            type: Object,
            default: () => ({})
        },
        customFormats: {
            type: Object,
            default: () => ({})
        },
        // 自定义校验
        customRule: {
            type: Function,
            default: null
        },
        widget: {
            type: [String, Function, Object],
            default: null
        },
        required: {
            type: Boolean,
            default: false
        },
        // 解决 JSON Schema和实际输入元素中空字符串 required 判定的差异性
        // 元素输入为 '' 使用 emptyValue 的值
        emptyValue: {
            type: null,
            default: undefined
        },
        rootFormData: {
            type: null
        },
        curNodePath: {
            type: String,
            default: ''
        },
        label: {
            type: String,
            default: ''
        },
        // width -> formItem width
        width: {
            type: String,
            default: ''
        },
        labelWidth: {
            type: String,
            default: ''
        },
        description: {
            type: String,
            default: ''
        },
        // Widget attrs
        widgetAttrs: {
            type: Object,
            default: () => ({})
        },
        // Widget className
        widgetClass: {
            type: Object,
            default: () => ({})
        },
        // Widget style
        widgetStyle: {
            type: Object,
            default: () => ({})
        },
        // Field attrs
        fieldAttrs: {
            type: Object,
            default: () => ({})
        },
        // Field className
        fieldClass: {
            type: Object,
            default: () => ({})
        },
        // Field style
        fieldStyle: {
            type: Object,
            default: () => ({})
        },
        // props
        uiProps: {
            type: Object,
            default: () => ({})
        },
        formProps: null,
        getWidget: null,
        globalOptions: null // 全局配置
    },
    emits: ['change'],
    setup(props, { emit }) {
        const widgetValue = computed({
            get() {
                if (props.isFormData) return getPathVal(props.rootFormData, props.curNodePath);

                return props.curValue;
            },
            set(value) {
                // 大多组件删除为空值会重置为null。
                const trueValue = (value === '' || value === null) ? props.emptyValue : value;
                if (props.isFormData) {
                    setPathVal(props.rootFormData, props.curNodePath, trueValue);
                }
                emit('change', trueValue);
            }
        });

        // 枚举类型默认值为第一个选项
        if (props.uiProps.enumOptions
            && props.uiProps.enumOptions.length > 0
            && widgetValue.value === undefined
            && widgetValue.value !== props.uiProps.enumOptions[0]
        ) {
            // array 渲染为多选框时默认为空数组
            if (props.schema.items) {
                widgetValue.value = [];
            } else if (props.required) {
                widgetValue.value = props.uiProps.enumOptions[0].value;
            }
        }

        // 获取到子组件实例
        const widgetRef = ref(null);
        // 提供一种特殊的配置 允许直接访问到 widget vm
        if (props.getWidget && typeof props.getWidget === 'function') {
            watch(widgetRef, () => {
                props.getWidget.call(null, widgetRef.value);
            });
        }

        return () => {
            // 判断是否为根节点
            const isRootNode = isRootNodePath(props.curNodePath);

            // labelPosition left/right
            const miniDesModel = props.formProps && props.formProps.labelPosition !== 'top';

            const descriptionVNode = (props.description) ? h(
                'p',
                {
                    innerHTML: props.description,
                    class: {
                        genFromWidget_des: true
                    }
                },
            ) : null;

            const { COMPONENT_MAP, ICONS_MAP } = props.globalOptions;
            const miniDescriptionVNode = (miniDesModel && descriptionVNode) ? h(resolveComponent(COMPONENT_MAP.popover), {
                style: {
                    margin: '0 2px',
                    fontSize: '16px',
                    cursor: 'pointer'
                },
                placement: 'top',
                trigger: 'hover'
            }, [
                descriptionVNode,
                h('i', {
                    slot: 'reference',
                    class: ICONS_MAP.question
                })
            ]) : null;

            // form-item style
            const formItemStyle = {
                ...props.fieldStyle,
                ...(props.width ? {
                    width: props.width,
                    flexBasis: props.width,
                    paddingRight: '10px'
                } : {})
            };

            return h(
                resolveComponent(COMPONENT_MAP.formItem),
                {
                    class: {
                        ...props.fieldClass,
                        genFormItem: true
                    },
                    style: formItemStyle,
                    ...props.fieldAttrs,

                    labelWidth: props.labelWidth,
                    ...props.isFormData ? {
                        // 这里对根节点打特殊标志，绕过elementUi无prop属性不校验
                        prop: isRootNode ? '__$$root' : path2prop(props.curNodePath),
                        rules: [
                            {
                                validator(rule, value, callback) {
                                    if (isRootNode) value = props.rootFormData;

                                    // 校验是通过对schema逐级展开校验 这里只捕获根节点错误
                                    const errors = validateFormDataAndTransformMsg({
                                        formData: value,
                                        schema: props.schema,
                                        uiSchema: props.uiSchema,
                                        customFormats: props.customFormats,
                                        errorSchema: props.errorSchema,
                                        required: props.required,
                                        propPath: path2prop(props.curNodePath)
                                    });
                                    if (errors.length > 0) return callback(errors[0].message);

                                    // customRule 如果存在自定义校验
                                    const curCustomRule = props.customRule;
                                    if (curCustomRule && (typeof curCustomRule === 'function')) {
                                        return curCustomRule({
                                            field: props.curNodePath,
                                            value,
                                            rootFormData: props.rootFormData,
                                            callback
                                        });
                                    }

                                    return callback();
                                },
                                trigger: 'blur'
                            }
                        ]
                    } : {},
                },
                {
                    // 错误只能显示一行，多余...
                    error: slotProps => (slotProps.error ? h('p', {
                        class: {
                            formItemErrorBox: true
                        },
                        title: slotProps.error
                    }, [slotProps.error]) : null),

                    // label
                    /*
                        TODO:这里slot如果从无到有会导致无法正常渲染出元素 怀疑是vue3 bug
                        如果使用 error 的形式渲染，ElementPlus label labelWrap 未做判断，使用 slots.default?.() 会得到 undefined
                    */
                    ...props.label ? {
                        label: () => h('span', {
                            class: {
                                genFormLabel: true,
                                genFormItemRequired: props.required,
                            },
                        }, [
                            `${props.label}`,
                            ...miniDescriptionVNode ? [miniDescriptionVNode] : [],
                            `${(props.formProps && props.formProps.labelSuffix) || ''}`
                        ])
                    } : {},

                    // default
                    default: () => [
                        // description
                        // 非mini模式显示 description
                        ...(!miniDesModel && descriptionVNode) ? [descriptionVNode] : [],

                        ...props.widget ? [
                            h( // 关键输入组件
                                resolveComponent(props.widget),
                                {
                                    style: props.widgetStyle,
                                    class: props.widgetClass,

                                    ...props.widgetAttrs,
                                    ...props.uiProps,
                                    modelValue: widgetValue.value, // v-model
                                    ref: widgetRef,
                                    'onUpdate:modelValue': function updateModelValue(event) {
                                        widgetValue.value = event;
                                    }
                                }
                            )
                        ] : []
                    ]
                }
            );
        };
    }
};