<?php
/**
 * Created by PhpStorm.
 * Date: 2021/8/28
 * Time: 18:14
 * description:
 */
namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;
use think\facade\Db;

class Goods extends Model
{
    protected $table = 'st_goods';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'goods_name|商品名称' => 'require',
        'shop|商户类型' => 'require',
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
            $allowField = ['goods_name','cover','description','content','price','imgurls','shop','rec','seller','seller_address','extras','ext_goods_no'];
            $data = filter_data($params,$allowField);

            $map  = [['is_deleted','=',0]];
            $id = isset($params['id'])?intval($params['id']):0;
            if(intval($id) > 0){
                $map[] = ['id','=',$id];
            }else if(!empty($data['shop']) && !empty($data['ext_goods_no'])){
                $map[] = ['shop','=',$data['shop']];
                $map[] = ['ext_goods_no','=',$data['ext_goods_no']];
            }

            $info = $this
                ->where(['id' => $id,'is_deleted' => 0])
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

    public static function getUrl($shop,$goodsNo){
        if($shop == 'mericari' || $shop == 'mercari'){
            return 'https://www.mercari.com/jp/items/'.$goodsNo.'/';
        }

        if($shop == 'yahoo_auction' || $shop == 'yahoo'){
            return 'https://page.auctions.yahoo.co.jp/jp/auction/'.$goodsNo;
        }
        return '#';
    }

    public static function ry2rmb($amount,$uid=0){
        if(floatval($amount) <=0){
            return $amount;
        }
        $rate = \think\facade\Config::get('config.EXCHANGE_RATE');
        if($uid >0){
            $userInfo = Db::name('users')
                ->alias('u')
                ->where('u.id', $uid)
                ->field('u.*,l.name as level_name,l.fee as level_fee,l.rate as level_rate')
                ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
                ->find();
            $rate = floatval($rate) + floatval($userInfo['level_rate']);
        }else{
            $userInfo = Db::name('user_levels')
                ->where('id', 1)
                ->field('rate')
                ->find();
            $rate = floatval($rate) + floatval($userInfo['rate']);
        }
        return ceil($amount*floatval($rate));
    }

}