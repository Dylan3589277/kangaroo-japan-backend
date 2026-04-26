<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/25
 * Time: 20:42
 * description:
 */
namespace app\common\model;

use app\common\library\WechatApp;
use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\facade\Db;
use think\helper\Str;
use think\Model;
use think\Validate;

class YahooBids extends Model
{
    protected $table = 'st_yahoo_bids';

    protected $autoWriteTimestamp = true;

    public static function getStatusArr($status=false){
        $arr = [
            '-1' => '报价失败',
            '0' => '报价中',
            '1' => '报价成功',
            '2' => '竞标成功',
            '3' => '竞标失败'
        ];
        if($status === false){
            return $arr;
        }
        return $arr[$status];
    }


    /**
     * 竞拍成功通知
     * @param $id
     * @return bool
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public static function sendSucMsg($id){
        $templateId = 'grzS5W2vc7bN8uJoRW8FEfSSirXo38YuTKM-Ij5IBZY';
        $info = Db::name('yahoo_bids')
            ->alias('yb')
            ->where('yb.id',$id)
            ->join('st_user_wechat u','u.uid=yb.uid','LEFT')
            ->field('yb.*,u.openid')
            ->find();
        if(!$info || empty($info['openid'])){
            return false;
        }
        $data = [
            'thing2' =>['value' => mb_strlen($info['goods_name']) > 20?mb_substr($info['goods_name'],0,20):$info['goods_name']],
            'thing4' =>['value' => '您的雅虎竞拍已成功'] // 20个字符以内
        ];
        try {
            $weixin = new WechatApp();
            $weixin->sendMsg($info['openid'],$templateId,'pages/daishujun/index/index',$data);
            return true;
        }catch (\Exception $e){
            return false;
        }
    }

    /**
     * 发送失败
     * @param $id
     * @return bool
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public static function sendFailMsg($id){
        $templateId = 'kX9o4ISBUerEM4NK5cvQmUlaWMwp56FR_vMlftznRl0';
        $info = Db::name('yahoo_bids')
            ->alias('yb')
            ->where('yb.id',$id)
            ->join('st_user_wechat u','u.uid=yb.uid','LEFT')
            ->field('yb.*,u.openid')
            ->find();
        if(!$info || empty($info['openid'])){
            return false;
        }
        $data = [
            'thing1' =>['value' => mb_strlen($info['goods_name']) > 20?mb_substr($info['goods_name'],0,20):$info['goods_name']],
            'thing2' =>['value' => '您的雅虎竞拍出价已被超'] // 20个字符以内
        ];
        try {
            $weixin = new WechatApp();
            $weixin->sendMsg($info['openid'],$templateId,'pages/daishujun/index/index',$data);
            return true;
        }catch (\Exception $e){
            return false;
        }
    }
}