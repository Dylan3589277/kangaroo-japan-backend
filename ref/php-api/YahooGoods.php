<?php
/**
 * Created by PhpStorm.
 * Date: 2021/8/29
 * Time: 10:01
 * description:
 */
namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;

class YahooGoods extends Model
{
    protected $table = 'st_goods_yahoo';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'goods_name|商品名称' => 'require',
        'cover|图片' => 'require',
        'price|价格' => 'require',
    ];
    /**
     * 错误提示
     * @var array
     */
    public $errMsg = [
    ];

    /**
     * 新增和编辑
     * @param $params
     * @return array
     */
    public function addRow($params){
        try{
            \validate($this->rules,$this->errMsg)->failException(true)->check($params);
            $allowField = [
                'goods_name',
                'cover',
                'bid_price',
                'fastprice',
                'content',
                'price',
                'imgurls',
                'extras',
                'goods_no',
                'bid_num',
                'left_time',
                'end_time',
                'seller',
                'seller_address',
                'buynowprice',
                'unused',
                'status',
                'freeship',
            ];
            $data = filter_data($params,$allowField);

            $info = $this
                ->where('goods_no','=',$data['goods_no'])
                ->where('is_deleted','=',0)
                ->find();
            if($info){
                $data['update_time'] = time();
                $res = $info->save($data);
            }else{
                $data['update_time'] = time();
                $data['create_time'] = time();
                $res = $this
                    ->insert($data,true);
            }

            if($res !== false){
                return [0,$info?$info['id']:$res];
            }
            return [1,'操作失败请稍后再试'];
        }catch (ValidateException $e){
            return [1,$e->getMessage()];
        }catch (Exception $e){
            return [1,$e->getMessage()];
        }
    }

}