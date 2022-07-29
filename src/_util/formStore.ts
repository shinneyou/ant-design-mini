/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import Schema from "async-validator";


export class Store {
  /**
   * events 主要存储了form的onValuesChange和onFinish
   * 在表单的任意内容修改时调用onValuesChange，具体逻辑可在trigger中查看逻辑
   * 在表单onFinish时使用
   * events[formId] = [onValuesChange, onFinish]
   */
  private events: Record<string, any>;

  /**
   * formTree维护整个页面的form表单项，包含required,rules,value等等
   * formTree[formId] = {
   * required: boolean;
   * rules: [];
   * values;
   * updateFieldValue: Function;
  }*/
  private formTree: Record<string, any>;

  // 在formItem中将 formItem的内容一项一项的fieldKey 添加如currentField中
  // 例如<form form='example'><FormItem name='itemExample'><Input /></FormItem>
  // 则在Input的mixins[form]的onInit 方法中会调用addFieldSet方法设置
  // currentField.example = ['itemExample']

  private currentField: Record<string, any>;

  private setFieldsValueTree: Record<string, any>;

  constructor() {
    this.events = {};
    this.formTree = {};
    this.currentField = {};
    this.setFieldsValueTree = {};
  }

  init(form: string, initVal: any, onValuesChange, onFinish): void {
    if (!initVal) return;
    Object.keys(initVal).forEach((field) => {
      if (!this.formTree[form]) {
        this.formTree[form] = {};
      }
      if (!this.formTree[form][field]) {
        this.formTree[form][field] = {};
      }
      this.formTree[form][field].value = initVal[field];
    });

    // 这里events 拿来干什么
    if (!this.events[form]) {
      this.events[form] = [onValuesChange, onFinish];
    }
    // currentField 的含义是
    if (!this.currentField[form]) {
      this.currentField[form] = [];
    }
    setTimeout(() => {
      this.initValidator(form);
    }, 0);
  }

  getInitValByField(form: string, field: string): any {
    return this.formTree[form][field].value;
  }

  /**
   * 在formItem的onInit中会调用store.bootstrap方法
   * 将formItem的若干内容绑定在formTree[formId][field]上，之后方便进行validator
   * @param form
   * @param field
   * @param rules
   * @param initialValue
   * @param required
   */
  bootstrap(
    form: string,
    field: string,
    rules: any[],
    initialValue: any,
    required: boolean
  ): void {
    if (!this.formTree[form]) {
      this.formTree[form] = {};
    }

    if (!this.currentField[form]) {
      this.currentField[form] = [];
    }

    if (!this.formTree[form][field]) {
      this.formTree[form][field] = {};
    }
    const prevVal = this.formTree[form][field].value;
    this.formTree[form][field].value = prevVal || initialValue || "";

    this.formTree[form][field].rules = rules;
    this.formTree[form][field].required = required;
  }

  addFieldSet(form: string, field: string): void {
    if (!this.currentField[form]) {
      this.currentField[form] = [];
    }
    this.currentField[form].push(field);
    this.initValidator(form);
  }

  /**
  更新了currentField[form].field，是否需要更新formTree[formId].field = {required, rules, value}呢？
   */
  updateFieldSet(form: string, prev: string, cur: string): void {
    const prevRealFieldIndex = this.currentField[form].find(
      (item) => item === prev
    );
    this.currentField[form].splice(prevRealFieldIndex, 1);
    this.currentField[form].push(cur);
  }

  /**
   *
   * 此方法在具体表单项的onInit中调用，
   * 用于将组件变化的updateFieldValue挂载在formTree[formId][field]上
   * @param form
   * @param field
   * @param updateFieldValue
   */
  addUpdateFiledValue(
    form: string,
    field: string,
    updateFieldValue: CallableFunction
  ): void {
    if (this.formTree[form] && this.formTree[form][field]) {
      const updateFiledValueArr = this.formTree[form][field].updateFieldValue;
      // updateFieldValue 在哪儿消费？
      if (Array.isArray(updateFiledValueArr)) {
        updateFiledValueArr.push(updateFieldValue);
      } else {
        this.formTree[form][field].updateFieldValue = [updateFieldValue];
      }
    }
  }

  // TODO update 数组--->需要解耦
  setValueAfterUpdate(setData, form: string, next: string): void {
    const val = this.formTree[form][next].value || "";
    setData({
      cValue: val, // 为什么是写死的cValue
    });
  }

  setFieldUpdateInfoFn(form, field, fn) {
    this.formTree[form][field].updateErrorInfo = fn;
  }

  setUpdateSubmitButtonStatusFn(form, field, fn) {
    this.formTree[form][field].updateSubmitButtonStatus = fn;
  }

  delFieldSet(form: string, field: string): void {
    const realFieldIndex = this.currentField[form].findIndex(
      (item) => item === field
    );
    this.currentField[form].splice(realFieldIndex, 1);
    if (this.formTree[form] && this.formTree[form][field]) {
      this.formTree[form][field] = null;
    }
    this.initValidator(form);
  }

  getTotalValue(form: string): any {
    const formData = this.formTree[form];
    const currentField = this.currentField[form];
    return Object.keys(formData).reduce((prev, cur) => {
      if (currentField.indexOf(cur) > -1) {
        // eslint-disable-next-line no-param-reassign
        prev[cur] = formData[cur].value;
      }
      return prev;
    }, {});
  }

  getFields(form) {
    if (!this.formTree[form]) return;
    if (!this.currentField[form]) return;
    const formData = this.formTree[form];
    const currentField = this.currentField[form];
    return Object.keys(formData).reduce((prev, cur) => {
      if (currentField.indexOf(cur) > -1) {
        // eslint-disable-next-line no-param-reassign
        prev[cur] = formData[cur];
      }
      return prev;
    }, {});
  }

  trigger(form: string, field: string, val: any): void {
    this.formTree[form][field].value = val;
    const handlers = this.events[form][0];
    const values = this.getTotalValue(form);
    this.formTree[form].validator.validate(
      { ...values, [field]: val },
      (errors) => {
        const updateErrorInfo = this.formTree[form][field]?.updateErrorInfo;
        const updateSubmitButtonStatus =
          this.formTree[form].submit?.updateSubmitButtonStatus;
        if (!errors) {
          updateErrorInfo?.(null);
          updateSubmitButtonStatus?.(null);
          return;
        }
        const error = errors.filter((item) => item.field === field)[0];

        if (error) {
          updateErrorInfo?.({ ...error });
        } else {
          updateErrorInfo?.(null);
        }

        updateSubmitButtonStatus?.(!!errors.length);
      }
    );

    const totalVal = this.getTotalValue(form);
    handlers({ [field]: val }, totalVal);
  }

  validateAll(form) {
    return new Promise((resolve) => {
      const values = this.getTotalValue(form);
      this.formTree[form].validator.validate(values, (errors) => {
        if (!errors) {
          return resolve(true);
        }
        const errFields = errors.reduce((prev, cur) => {
          prev[cur.field] = cur;
          return prev;
        }, {});

        const fields = this.getFields(form);
        if (!fields) return;
        Object.keys(fields).forEach((field) => {
          if (!errFields[field]) {
            this.formTree[form][field]?.updateErrorInfo(null);
          } else {
            this.formTree[form][field]?.updateErrorInfo({
              ...errFields[field],
            });
          }
        });
        const updateSubmitButtonStatus =
          this.formTree[form].submit?.updateSubmitButtonStatus;
        if (errors.length) {
          // errors.forEach(err => {
          //   this.formTree[form][err.field]?.updateErrorInfo({ ...err });
          // });
          my.alert({ title: errors[0].message });
        }
        updateSubmitButtonStatus?.(!!errors.length);
        resolve(!errors.length);
      });
    });
  }

  setFieldsValue(form: string, value: any): void {
    Object.keys(value).forEach((key) => {
      if (
        this.currentField[form] &&
        this.currentField[form].find((item) => item === key)
      ) {
        if (
          !this.formTree[form][key] ||
          !this.formTree[form][key].updateFieldValue
        )
          return;
        this.formTree[form][key].updateFieldValue.forEach((fn) => {
          if (typeof fn === "function") {
            this.formTree[form][key].value = value[key];
            fn(value[key]);
          }
        });
      }
    });

    this.validateAll(form);
  }

  async onFinish(form: () => string): Promise<any> {
    if (!form) return;
    const success = await this.validateAll(form());
    if (!success) return;
    this.events[form()][1](this.getTotalValue(form()));
  }

  /**
   * @TODO: 这里需要销毁this.currentField[formName] = null
   * @param formName
   */
  tear(formName: string): void {
    this.formTree[formName] = null;
    this.events[formName] = null;
  }

  initValidator(form) {
    const fields = this.getFields(form);
    if (!fields) return;
    const descriptor = {};
    Object.keys(fields).forEach((field) => {
      const { rules, required, label } = fields[field];
      if (Array.isArray(rules)) {
        descriptor[field] = [...rules];
      }
      if (required) {
        const requiredItem = {
          required,
          message: label ? `请输入${label}` : "请输入必填项",
        };
        if (descriptor[field]) {
          descriptor[field].unshift(requiredItem);
        } else {
          descriptor[field] = [requiredItem];
        }
      }
    });
    this.formTree[form].validator = new Schema(descriptor);
  }
}
