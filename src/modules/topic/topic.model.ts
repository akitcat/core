import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator'
import slugify from 'slugify'

import { index, modelOptions, prop } from '@typegoose/typegoose'

import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: 'Topic',
  },
})
@index({ name: 1 })
export class TopicModel extends BaseModel {
  @prop({ default: '' })
  @MaxLength(400, { message: '描述信息最多 400 个字符' })
  @IsOptional()
  @IsString()
  description?: string

  @prop()
  @IsString()
  introduce: string

  @prop({ unique: true })
  @IsString()
  @IsNotEmpty({
    message: '话题名称不能为空',
  })
  @MaxLength(50)
  name: string

  @prop({
    unique: true,
    set(val) {
      return slugify(val)
    },
  })
  @IsString({
    message: '路径必须是字符串',
  })
  @IsNotEmpty()
  slug: string

  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: '请输入正确的 URL',
    },
  )
  @prop()
  @IsOptional()
  icon?: string
}
