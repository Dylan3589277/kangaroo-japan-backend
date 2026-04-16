import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";

@Controller("api/v1/addresses")
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async findAll(@Req() req: any) {
    const addresses = await this.addressesService.findAll(req.user.id);
    return {
      success: true,
      data: addresses.map((addr) => this.addressesService.transformAddress(addr)),
    };
  }

  @Get(":id")
  async findOne(@Req() req: any, @Param("id") id: string) {
    const address = await this.addressesService.findOne(req.user.id, id);
    return {
      success: true,
      data: this.addressesService.transformAddress(address),
    };
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateAddressDto) {
    const address = await this.addressesService.create(req.user.id, dto);
    return {
      success: true,
      data: this.addressesService.transformAddress(address),
      message: "Address created successfully",
    };
  }

  @Put(":id")
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const address = await this.addressesService.update(req.user.id, id, dto);
    return {
      success: true,
      data: this.addressesService.transformAddress(address),
      message: "Address updated successfully",
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async delete(@Req() req: any, @Param("id") id: string) {
    await this.addressesService.delete(req.user.id, id);
    return {
      success: true,
      message: "Address deleted successfully",
    };
  }

  @Put(":id/default")
  async setDefault(@Req() req: any, @Param("id") id: string) {
    const address = await this.addressesService.setDefault(req.user.id, id);
    return {
      success: true,
      data: this.addressesService.transformAddress(address),
      message: "Default address updated",
    };
  }
}
