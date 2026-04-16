import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserStatus, UserRole } from "./user.entity";
import { Address } from "./address.entity";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Address)
    private addressesRepository: Repository<Address>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    Object.assign(user, data);
    return this.usersRepository.save(user);
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(id, { passwordHash });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, { lastLoginAt: new Date() });
  }

  async checkEmailOrPhoneExists(email?: string, phone?: string): Promise<boolean> {
    if (email) {
      const existing = await this.findByEmail(email);
      if (existing) return true;
    }
    if (phone) {
      const existing = await this.findByPhone(phone);
      if (existing) return true;
    }
    return false;
  }

  // Address methods
  async getAddresses(userId: string): Promise<Address[]> {
    return this.addressesRepository.find({
      where: { userId },
      order: { isDefault: "DESC", createdAt: "DESC" },
    });
  }

  async getAddressById(userId: string, addressId: string): Promise<Address | null> {
    return this.addressesRepository.findOne({
      where: { id: addressId, userId },
    });
  }

  async createAddress(userId: string, data: Partial<Address>): Promise<Address> {
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await this.addressesRepository.update({ userId }, { isDefault: false });
    }
    const address = this.addressesRepository.create({ ...data, userId });
    return this.addressesRepository.save(address);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    data: Partial<Address>,
  ): Promise<Address> {
    const address = await this.getAddressById(userId, addressId);
    if (!address) {
      throw new NotFoundException("Address not found");
    }
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.addressesRepository.update({ userId }, { isDefault: false });
    }
    Object.assign(address, data);
    return this.addressesRepository.save(address);
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.getAddressById(userId, addressId);
    if (!address) {
      throw new NotFoundException("Address not found");
    }
    await this.addressesRepository.remove(address);
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<Address> {
    const address = await this.getAddressById(userId, addressId);
    if (!address) {
      throw new NotFoundException("Address not found");
    }
    await this.addressesRepository.update({ userId }, { isDefault: false });
    address.isDefault = true;
    return this.addressesRepository.save(address);
  }
}
