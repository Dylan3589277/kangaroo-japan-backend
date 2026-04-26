<?php
namespace app\common\model\Shipment;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;

class ShipmentPrices extends Model
{
    protected $table = 'st_shipment_prices';

    protected $autoWriteTimestamp = true;

}