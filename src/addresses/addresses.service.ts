import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address, AddressCountry } from '../users/address.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

const COUNTRY_NAMES: Record<
  AddressCountry,
  { zh: string; en: string; ja: string }
> = {
  [AddressCountry.CN]: { zh: '中国', en: 'China', ja: '中国' },
  [AddressCountry.JP]: { zh: '日本', en: 'Japan', ja: '日本' },
  [AddressCountry.US]: {
    zh: '美国',
    en: 'United States',
    ja: 'アメリカ合衆国',
  },
  [AddressCountry.UK]: { zh: '英国', en: 'United Kingdom', ja: 'イギリス' },
  [AddressCountry.AU]: {
    zh: '澳大利亚',
    en: 'Australia',
    ja: 'オーストラリア',
  },
  [AddressCountry.DE]: { zh: '德国', en: 'Germany', ja: 'ドイツ' },
  [AddressCountry.FR]: { zh: '法国', en: 'France', ja: 'フランス' },
  [AddressCountry.KR]: { zh: '韩国', en: 'South Korea', ja: '韓国' },
  [AddressCountry.TW]: { zh: '台湾', en: 'Taiwan', ja: '台湾' },
  [AddressCountry.HK]: { zh: '香港', en: 'Hong Kong', ja: '香港' },
  [AddressCountry.SG]: { zh: '新加坡', en: 'Singapore', ja: 'シンガポール' },
  [AddressCountry.CA]: { zh: '加拿大', en: 'Canada', ja: 'カナダ' },
  [AddressCountry.OTHER]: { zh: '其他', en: 'Other', ja: 'その他' },
};

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private addressesRepository: Repository<Address>,
  ) {}

  async findAll(userId: string): Promise<Address[]> {
    return this.addressesRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, addressId: string): Promise<Address> {
    const address = await this.addressesRepository.findOne({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    // If setting as default, unset other defaults first
    if (dto.isDefault) {
      await this.addressesRepository.update({ userId }, { isDefault: false });
    }

    // Map prefecture to state (for Japanese addresses)
    const { prefecture, ...rest } = dto;
    const addressData = {
      ...rest,
      state: dto.state || prefecture,
    };

    // Generate full address text in multiple languages
    const fullAddressText = this.generateFullAddressText(
      addressData as CreateAddressDto,
    );

    const address = this.addressesRepository.create({
      ...addressData,
      userId,
      fullAddressText,
    });

    return this.addressesRepository.save(address);
  }

  async update(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.findOne(userId, addressId);

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.addressesRepository.update({ userId }, { isDefault: false });
    }

    // Map prefecture to state (for Japanese addresses)
    const { prefecture: prefectureVal, ...restDto } = dto;
    const mappedDto: Omit<UpdateAddressDto, 'prefecture'> = {
      ...restDto,
      ...(prefectureVal && !dto.state ? { state: prefectureVal } : {}),
    };

    // Merge update data
    Object.assign(address, mappedDto);

    // Regenerate full address text if address fields changed
    if (
      dto.addressLine1 ||
      dto.addressLine2 ||
      dto.city ||
      dto.state ||
      dto.country ||
      dto.postalCode
    ) {
      address.fullAddressText = this.generateFullAddressText({
        ...address,
        ...dto,
      } as CreateAddressDto);
    }

    return this.addressesRepository.save(address);
  }

  async delete(userId: string, addressId: string): Promise<void> {
    const address = await this.findOne(userId, addressId);
    await this.addressesRepository.remove(address);
  }

  async setDefault(userId: string, addressId: string): Promise<Address> {
    const address = await this.findOne(userId, addressId);

    // Unset all other defaults
    await this.addressesRepository.update({ userId }, { isDefault: false });

    // Set this one as default
    address.isDefault = true;
    return this.addressesRepository.save(address);
  }

  private generateFullAddressText(
    dto: CreateAddressDto,
  ): Record<string, string> {
    const country = dto.country || AddressCountry.CN;
    const countryInfo = COUNTRY_NAMES[country];

    const parts = [
      countryInfo.zh,
      dto.state || '',
      dto.city || '',
      dto.district || '',
      dto.addressLine1 || '',
      dto.addressLine2 || '',
    ].filter(Boolean);

    const partsJa = [
      countryInfo.ja,
      dto.state || '',
      dto.city || '',
      dto.district || '',
      dto.addressLine1 || '',
      dto.addressLine2 || '',
    ].filter(Boolean);

    const partsEn = [
      dto.addressLine1 || '',
      dto.addressLine2 || '',
      dto.city || '',
      dto.state || '',
      countryInfo.en,
    ].filter(Boolean);

    return {
      zh: parts.join(''),
      ja: partsJa.join(''),
      en: partsEn.join(', '),
    };
  }

  // Transform address for API response
  transformAddress(address: Address) {
    const country = address.country;
    return {
      id: address.id,
      recipientName: address.recipientName,
      phone: address.phone,
      email: address.email,
      country: address.country,
      countryName: COUNTRY_NAMES[country] || {
        zh: '其他',
        en: 'Other',
        ja: 'その他',
      },
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      state: address.state,
      prefecture: address.state, // alias for Japanese addresses
      stateCode: address.stateCode,
      city: address.city,
      cityCode: address.cityCode,
      district: address.district,
      districtCode: address.districtCode,
      postalCode: address.postalCode,
      fullAddressText: address.fullAddressText,
      label: address.label,
      isDefault: address.isDefault,
      alternativeRecipientName: address.alternativeRecipientName,
      alternativePhone: address.alternativePhone,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
