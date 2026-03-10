/**
 * 報名欄位設定共用工具
 *
 * - 管理 event_projects.form_config 的預設值與合併規則
 * - 提供前端動態渲染可用的欄位定義
 */

const CORE_REQUIRED_FIELDS = ['name', 'email', 'phone', 'data_consent'];
const REGISTRATION_CONFIG_VERSION = 2;
const REGISTRATION_CONFIG_SCHEMA_ID = 'registration-config.v2';

const FIELD_ORDER = [
    'name',
    'email',
    'phone',
    'company',
    'position',
    'gender',
    'title',
    'notes',
    'adult_age',
    'children_ages',
    'children_count',
    'data_consent',
    'marketing_consent'
];

const FIELD_META = {
    name: { type: 'string', submit: true, label: '姓名', example: '王大明' },
    email: { type: 'email', submit: true, label: '電子郵件', example: 'wang@example.com' },
    phone: { type: 'string', submit: true, label: '手機號碼', example: '0912345678' },
    company: { type: 'string', submit: true, label: '公司名稱', example: 'MICE AI' },
    position: { type: 'string', submit: true, label: '職位', example: '產品經理' },
    gender: { type: 'enum', submit: true, label: '性別', option_key: 'gender_options', example: '男' },
    title: { type: 'enum', submit: true, label: '尊稱', option_key: 'title_options', example: '先生' },
    notes: { type: 'string', submit: true, label: '留言備註', example: '需要素食餐點' },
    adult_age: { type: 'integer', submit: true, label: '成人年齡', example: 30 },
    children_ages: {
        type: 'object',
        ui_type: 'age_range_select',
        submit: true,
        label: '小孩年齡區間',
        option_key: 'children_age_range_options',
        example: { age_0_6: 1, age_6_12: 0, age_12_18: 0 }
    },
    children_count: { type: 'integer', submit: false, label: '小孩人數（自動計算）', example: 1 },
    data_consent: { type: 'boolean', submit: true, label: '我同意個人資料蒐集與使用說明', example: true },
    marketing_consent: { type: 'boolean', submit: true, label: '我同意接收活動通知與行銷資訊', example: false }
};

const DEFAULT_FORM_CONFIG = {
    required_fields: [...CORE_REQUIRED_FIELDS],
    optional_fields: [
        'company',
        'position',
        'gender',
        'title',
        'notes',
        'adult_age',
        'children_ages',
        'children_count',
        'marketing_consent'
    ],
    field_labels: {
        name: '姓名',
        email: '電子郵件',
        phone: '手機號碼',
        company: '公司名稱',
        position: '職位',
        gender: '性別',
        title: '尊稱',
        notes: '留言備註',
        adult_age: '成人年齡',
        children_ages: '小孩年齡區間',
        children_count: '小孩人數（自動計算）',
        data_consent: '我同意個人資料蒐集與使用說明',
        marketing_consent: '我同意接收活動通知與行銷資訊'
    },
    gender_options: ['男', '女', '其他'],
    title_options: ['先生', '女士', '博士', '教授'],
    children_age_range_options: [
        { value: '0-6', key: 'age_0_6', label: '0-6歲' },
        { value: '6-12', key: 'age_6_12', label: '6-12歲' },
        { value: '12-18', key: 'age_12_18', label: '12-18歲' }
    ],
    feature_toggles: {
        show_event_info: true,
        show_booth_info: false,
        show_voucher_info: false,
        show_vendor_info: false,
        show_inventory_info: false
    },
    interstitial_effect: {
        enabled: false,
        asset: null
    }
};

function uniqueList(items) {
    return Array.from(new Set(items));
}

function parseFormConfig(rawConfig) {
    if (!rawConfig) return {};

    if (typeof rawConfig === 'string') {
        try {
            return JSON.parse(rawConfig);
        } catch (error) {
            return {};
        }
    }

    if (typeof rawConfig === 'object') {
        return rawConfig;
    }

    return {};
}

function normalizeFormConfig(rawConfig) {
    const parsed = parseFormConfig(rawConfig);

    const requiredFieldsRaw = Array.isArray(parsed.required_fields)
        ? parsed.required_fields
        : DEFAULT_FORM_CONFIG.required_fields;

    const optionalFieldsRaw = Array.isArray(parsed.optional_fields)
        ? parsed.optional_fields
        : DEFAULT_FORM_CONFIG.optional_fields;

    const knownFieldSet = new Set(FIELD_ORDER);

    const requiredFields = uniqueList([
        ...CORE_REQUIRED_FIELDS,
        ...requiredFieldsRaw
    ]).filter(field => knownFieldSet.has(field));

    const requiredFieldSet = new Set(requiredFields);

    const optionalFields = uniqueList(optionalFieldsRaw)
        .filter(field => knownFieldSet.has(field))
        .filter(field => !requiredFieldSet.has(field));

    const genderOptions = Array.isArray(parsed.gender_options) && parsed.gender_options.length > 0
        ? parsed.gender_options
        : DEFAULT_FORM_CONFIG.gender_options;

    const titleOptions = Array.isArray(parsed.title_options) && parsed.title_options.length > 0
        ? parsed.title_options
        : DEFAULT_FORM_CONFIG.title_options;
    const childrenAgeRangeOptions = Array.isArray(parsed.children_age_range_options) && parsed.children_age_range_options.length > 0
        ? parsed.children_age_range_options
        : DEFAULT_FORM_CONFIG.children_age_range_options;

    const featureToggles = {
        ...DEFAULT_FORM_CONFIG.feature_toggles,
        ...(parsed.feature_toggles || {})
    };

    const interstitialEffect = normalizeInterstitialEffect(parsed.interstitial_effect);

    return {
        required_fields: requiredFields,
        optional_fields: optionalFields,
        field_labels: {
            ...DEFAULT_FORM_CONFIG.field_labels,
            ...(parsed.field_labels || {})
        },
        gender_options: genderOptions,
        title_options: titleOptions,
        children_age_range_options: childrenAgeRangeOptions,
        feature_toggles: featureToggles,
        interstitial_effect: interstitialEffect
    };
}

function normalizeInterstitialAsset(rawAsset) {
    if (!rawAsset || typeof rawAsset !== 'object') {
        return null;
    }

    const url = typeof rawAsset.url === 'string' ? rawAsset.url.trim() : '';
    if (!url) {
        return null;
    }

    // 安全策略收斂：僅允許本地 uploads 路徑，避免惡意外鏈素材
    const isSafeLocalUploadUrl = /^\/uploads\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/]*$/.test(url);
    if (!isSafeLocalUploadUrl) {
        return null;
    }

    const mimeType = typeof rawAsset.mime_type === 'string' ? rawAsset.mime_type.trim() : '';
    let type = typeof rawAsset.type === 'string' ? rawAsset.type.trim().toLowerCase() : '';
    if (!type) {
        if (mimeType === 'video/mp4') type = 'mp4';
        if (mimeType === 'image/gif') type = 'gif';
    }
    if (!['gif', 'mp4'].includes(type)) {
        type = 'gif';
    }

    const fileName = typeof rawAsset.file_name === 'string' ? rawAsset.file_name.trim() : '';
    const parsedFileSize = Number(rawAsset.file_size);
    const fileSize = Number.isFinite(parsedFileSize) && parsedFileSize >= 0 ? parsedFileSize : 0;

    return {
        type,
        url,
        mime_type: mimeType || (type === 'mp4' ? 'video/mp4' : 'image/gif'),
        file_name: fileName,
        file_size: fileSize
    };
}

function normalizeInterstitialEffect(rawEffect) {
    const effect = rawEffect && typeof rawEffect === 'object' ? rawEffect : {};

    return {
        enabled: effect.enabled === true || effect.enabled === 1 || effect.enabled === '1' || effect.enabled === 'true',
        asset: normalizeInterstitialAsset(effect.asset)
    };
}

function buildFrontendFields(formConfig) {
    const config = normalizeFormConfig(formConfig);
    const requiredFieldSet = new Set(config.required_fields);
    const optionalFieldSet = new Set(config.optional_fields);

    return FIELD_ORDER.map((fieldKey) => {
        const meta = FIELD_META[fieldKey];
        const enabled = requiredFieldSet.has(fieldKey) || optionalFieldSet.has(fieldKey);
        const field = {
            key: fieldKey,
            label: config.field_labels[fieldKey] || meta.label,
            type: meta.type,
            enabled,
            required: requiredFieldSet.has(fieldKey),
            submit: meta.submit
        };

        if (meta.option_key) {
            field.options = config[meta.option_key] || [];
        }
        if (meta.ui_type) {
            field.ui_type = meta.ui_type;
        }

        return field;
    });
}

function buildFieldSummary(formConfig) {
    const fields = buildFrontendFields(formConfig);

    return {
        total_fields: fields.length,
        enabled_fields: fields.filter(field => field.enabled).length,
        required_fields_count: fields.filter(field => field.required).length,
        optional_fields_count: fields.filter(field => field.enabled && !field.required).length
    };
}

function buildPayloadExample(formConfig) {
    const fields = buildFrontendFields(formConfig);
    const payload = {};

    for (const field of fields) {
        if (!field.enabled || !field.submit) continue;
        payload[field.key] = FIELD_META[field.key].example;
    }

    return payload;
}

module.exports = {
    CORE_REQUIRED_FIELDS,
    REGISTRATION_CONFIG_VERSION,
    REGISTRATION_CONFIG_SCHEMA_ID,
    DEFAULT_FORM_CONFIG,
    normalizeFormConfig,
    normalizeInterstitialEffect,
    normalizeInterstitialAsset,
    buildFrontendFields,
    buildFieldSummary,
    buildPayloadExample
};
