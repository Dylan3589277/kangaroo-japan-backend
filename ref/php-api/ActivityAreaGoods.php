<?php
namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;

class ActivityAreaGoods extends Model
{
    protected $table = 'st_activity_area_goods';
}