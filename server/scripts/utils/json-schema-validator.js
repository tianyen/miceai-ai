const { isDeepStrictEqual } = require('node:util');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function typeMatches(value, expectedType) {
  if (expectedType === 'integer') return Number.isInteger(value);
  if (expectedType === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (expectedType === 'array') return Array.isArray(value);
  if (expectedType === 'object') return isObject(value);
  if (expectedType === 'null') return value === null;
  return typeof value === expectedType;
}

function validateAgainstSchema(value, schema, path = '$') {
  const errors = [];
  _validate(value, schema, path, errors);
  return {
    valid: errors.length === 0,
    errors
  };
}

function _validate(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') {
    return;
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const anyPass = schema.anyOf.some((candidate) => validateAgainstSchema(value, candidate, path).valid);
    if (!anyPass) {
      errors.push(`${path}: 不符合 anyOf 條件`);
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !isDeepStrictEqual(value, schema.const)) {
    errors.push(`${path}: 必須等於常數 ${JSON.stringify(schema.const)}`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((item) => isDeepStrictEqual(item, value))) {
    errors.push(`${path}: 不在允許值 ${JSON.stringify(schema.enum)} 內`);
  }

  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matched = expectedTypes.some((typeName) => typeMatches(value, typeName));
    if (!matched) {
      errors.push(`${path}: 型別錯誤，預期 ${expectedTypes.join('|')}，實際 ${getType(value)}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${path}: 長度不足，至少 ${schema.minLength}`);
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`${path}: 字串格式不符合 pattern=${schema.pattern}`);
      }
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path}: 數值不得小於 ${schema.minimum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${path}: 陣列長度至少 ${schema.minItems}`);
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        _validate(value[i], schema.items, `${path}[${i}]`, errors);
      }
    }
  }

  if (isObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const requiredKey of required) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        errors.push(`${path}.${requiredKey}: 缺少必填欄位`);
      }
    }

    const properties = isObject(schema.properties) ? schema.properties : {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        _validate(value[key], propSchema, `${path}.${key}`, errors);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`${path}.${key}: 不允許額外欄位`);
        }
      }
    } else if (isObject(schema.additionalProperties)) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          _validate(value[key], schema.additionalProperties, `${path}.${key}`, errors);
        }
      }
    }
  }
}

module.exports = {
  validateAgainstSchema
};
