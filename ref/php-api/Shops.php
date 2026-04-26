<?php
namespace app\api\controller;


use app\common\model\UserCoupons;
use app\common\model\UserModel;
use think\App;
use think\Exception;
use think\facade\Db;


class Shops extends Base
{
    public function __construct(App $app)
    {
        parent::__construct($app);
    }

    public function goods(){
        $map = [['is_deleted','=',0],['canbuy','=',1]];
        $result = Db::name('coupons')
            ->where($map)
            ->order('id desc')
            ->field('id,name,icon,stock,score')
            ->paginate(20)->toArray();
        $list = $result['data']??[];
        foreach ($list as &$item){
            $item['icon'] = oss_url($item['icon']);
        }
        return $this->jsuccess('ok', ['list' => $list, 'total' => intval($result['total'])]);
    }

    public function buy(){
        if(!$this->request->isPost()){
            return $this->jerror(' method error');
        }
        $id = input('id',0);
        $this->requestLimit();
        $couponInfo = Db::name('coupons')
            ->where('id',intval($id))
            ->where('is_deleted',0)
            ->where('canbuy',1)
            ->find();
        if(!$couponInfo){
            return $this->jerror('该商品不存在');
        }

        if($couponInfo['stock'] <= 0){
            return $this->jerror('该商品数量不足');
        }
        if($this->userInfo['score'] < $couponInfo['score']){
            return $this->jerror('剩余积分不足');
        }
        //-- 扣几分
        //-- 开始录入数据库
        $model = new UserCoupons();
        $model->startTrans();
        try {
            //-- 扣除积分
            $res = UserModel::addScore($this->uid,$couponInfo['score']*-1,2,'积分兑换扣除');
            if (!$res) {
                throw new \Exception('扣除积分失败，请稍后再试');
            }
            $res = $model->addRow($couponInfo,['id' => $this->uid],2);
            if(!$res){
                throw new \Exception('兑换优惠券失败');
            }
            $res = Db::name('coupons')
                ->where('id',$couponInfo['id'])
                ->dec('stock',1)
                ->update();
            if(!$res){
                throw new \Exception('兑换优惠券失败');
            }
            $model->commit();
            return $this->jsuccess('兑换成功');
        }catch (\Exception $e){
            $model->rollback();
            return $this->jerror($e->getMessage());
        }

    }


    /**
     * 领取和购买优惠券
     */
    public function getcoupon()
    {
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $this->requestLimit();
        //仅限canbuy=1 或 免费领取
        $id = input('id',0);
        $type = input('type','');
        if(intval($id) <=0 || !in_array($type,['buy','home'])){
            return $this->jerror('参数错误');
        }
        $model = new \app\common\model\Coupons();
        $info = $model
            ->where('id',intval($id))
            ->where('is_deleted',0)
            ->find();

        if(!$info){
            return $this->jerror('该优惠券不存在');
        }

        if($type == 'buy' && ($info['canbuy'] != 1 || $info['score'] <=0 )){
            return $this->jerror('该优惠券不可积分兑换');
        }

        if($type == 'home' && $info['act_type'] != 'home'){
            return $this->jerror('该优惠券不可领取');
        }

        if($info['canbuy'] == 1 && $this->userInfo['score'] < $info['score']){
            return $this->jerror('剩余积分不足');
        }

        //-- 开始录入数据库
        $model->startTrans();

        try {
            $extraArr = json_decode($info['act_extras'],true);
            if(isset($extraArr['total']) && intval($extraArr['total']) > 0){
                //全程限制次数
                $count = (new UserCoupons())
                    ->where('uid',$this->uid)
                    ->where('cid',$info['id'])
                    ->count();
                if($count >= intval($extraArr['total'])){
                    throw new \Exception(sprintf('该优惠券仅限领取%s次',$extraArr['total']));
                }
            }
            if(isset($extraArr['daynum']) && intval($extraArr['daynum']) > 0){
                //每天限制次数
                $count = (new UserCoupons())
                    ->where('uid',$this->uid)
                    ->where('cid',$info['id'])
                    ->where('create_time','>',strtotime(date('Y-m-d')))
                    ->count();
                if($count >= intval($extraArr['daynum'])){
                    throw new \Exception(sprintf('该优惠券每天仅限领取%s次',$extraArr['daynum']));
                }
            }

            //-- 扣除积分
            if($info['canbuy'] > 0){
                $res = UserModel::addScore($this->uid,$info['score']*-1,10,'积分兑换扣除');
                if (!$res) {
                    throw new \Exception('扣除积分失败，请稍后再试');
                }
            }
            $res = (new UserCoupons())->addRow($info,['id' => $this->uid],3);
            if (!$res) {
                throw new \Exception('优惠券领取失败');
            }
            $model->commit();
            return $this->jsuccess('领取成功');
        }catch (\Exception $e){
            $model->rollback();
            return $this->jerror($e->getMessage());
        }

    }
}