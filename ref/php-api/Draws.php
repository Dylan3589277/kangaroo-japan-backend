<?php
/**
 * Created by PhpStorm.
 * Date: 2021/8/28
 * Time: 18:14
 * description:
 */

namespace app\common\model;

use think\exception\ValidateException;
use think\facade\Db;
use think\Model;

class Draws extends Model
{
    protected $table = 'st_draw_activitys';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public $rules = [
        'name|名称' => 'require',
        'price|价格' => 'require'
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
    public function addRow($params)
    {
        try {
            \validate($this->rules, $this->errMsg)->failException(true)->check($params);
            $allowField = ['name', 'cover','content', 'remark','stock', 'price', 'run_type','rundate'];
            $data = filter_data($params, $allowField);

            if(in_array($data['run_type'],['week','month','year']) && empty($data['rundate'])){
                throw new \Exception('具体执行日期不能为空');
            }

            $id = isset($params['id']) ? intval($params['id']) : 0;

            $this->startTrans();;
            if ($id > 0) {
                $info = $this
                    ->where(['id' => $id, 'is_deleted' => 0])
                    ->find();
                if (!$info) {
                    throw new \Exception('该抽奖不存在');
                }
                $data['update_time'] = time();
                $res = $info->save($data);
            } else {
                $data['bid'] = getSnowFlakeId();
                $data['update_time'] = time();
                $data['create_time'] = time();
                $res = $this
                    ->insert($data, true);
            }

            if (!$res) {
                throw new \Exception('操作失败请稍后再试');
            }

            $this->commit();
            return [0, $id > 0 ? $id : $res];
        } catch (ValidateException | \Exception $e) {
            $this->rollback();
            return [1, $e->getMessage()];
        }
    }

    /**
     * 获取箱子配置的商品
     */
    public function getBoxGoods($did,$fields='gid,name,type,prize,cover'){
        $prizeModel = new DrawPrizes();
        $propList      = $prizeModel
            ->where('did',$did)
            ->where('is_deleted',0)
            ->field($fields)
            ->order('price desc')
            ->select()->toArray();
        foreach ($propList as &$item){
            $item['cover'] = oss_url($item['cover']);
        }
        return $propList;
    }

    public function doDraw($boxInfo,$propList,$userInfo){
        try {
            $leftKey = 'left_number';
            $numKey = 'number';
            $leftTotalNumber = array_sum(array_column($propList,$leftKey));
            if(intval($leftTotalNumber) <=0){
                throw new \Exception('库存不足');
            }
            $numRate = 1;
            // 奖池总数量
            $totalNum = array_sum(array_column($propList,$numKey));
            //-- 将奖品装入箱子
            $drawBox = [];
            foreach ($propList as $key => $item) {
                $num = ceil($numRate * $item[$leftKey]);
                if($num <=0){
                    continue;
                }
                array_push($drawBox,...array_pad([],$num,$key));
            }
            if (count($drawBox) <= 0) {
                throw new \Exception('库存不足');
            }
            shuffle($drawBox);
            $keyIndex = array_rand($drawBox);
            $propKey = $drawBox[$keyIndex];
            $resultPropInfo = $propList[$propKey];

            //-- 开始录入数据库
            $this->startTrans();

            //-- 扣除余额
            $amount = $boxInfo['price'];
            $res1 = ScoreLogs::addLog($userInfo['id'],-$amount,$userInfo['score'],ScoreLogs::$TYPE_OPEN,'积分转盘扣除');
            $res = (new UserModel())->where('id',$userInfo['id'])->save(['score' => Db::raw('score - '.$amount)]);
            if(!$res || !$res1){
                throw new \Exception('扣除积分失败，请稍后再试');
            }

            //-- 增加开箱记录
            $logRes = (new DrawLogs())->addLog($boxInfo,$resultPropInfo,$userInfo);
            if(!$logRes){
                throw new \Exception('增加日志失败');
            }
            //-- 发送奖励
            if(!in_array($resultPropInfo['type'],['coupon','score'])){
                throw new \Exception('奖品配置错误');
            }
            if($resultPropInfo['type'] == 'coupon'){
                $couponInfo = Db::name('coupons')
                    ->where('id',$resultPropInfo['prize'])
                    ->where('is_deleted',0)
                    ->find();
                if(!$couponInfo){
                    throw new \Exception('配置优惠券异常');
                }
                if($couponInfo['stock'] <=0){
                    throw new \Exception('优惠券剩余库存不足');
                }
                $prizeRes = (new UserCoupons())->addRow($couponInfo,$userInfo);
                if(!$prizeRes){
                    throw new \Exception('发放优惠券失败');
                }
            }else{
                //-- 增加积分
                $res1 = ScoreLogs::addLog($userInfo['id'],$resultPropInfo['prize'],$userInfo['score']-$amount,ScoreLogs::$TYPE_OPEN,'积分转盘奖励');
                $res = (new UserModel())->where('id',$userInfo['id'])->update([
                    'score' => Db::raw('score + '.$resultPropInfo['prize']),
                    'score_total' => Db::raw('score_total + '.$resultPropInfo['prize'])
                ]);
                if(!$res || !$res1){
                    throw new \Exception('奖励积分失败，请稍后再试');
                }
            }

            //-- 扣除库存和增加销量
            $res = Db::name('draw_prizes')
                ->where('id',$resultPropInfo['id'])
                ->inc('sales')
                ->dec($leftKey)
                ->update();
            //-- 处理箱子的
            $res1 = Db::name('draw_activitys')
                ->where('id',$boxInfo['id'])
                ->inc('sales')
                ->dec('stock')
                ->update();
            if(!$res || !$res1){
                throw new \Exception('更新销量失败，请稍后再试');
            }

            $this->commit();

            if($leftTotalNumber - 1 <=0){
                self::resetBoxGoodsNumber($boxInfo['id'],$leftKey,$numKey);
            }

            return [0,$resultPropInfo];
        }catch (\Exception $e){
            $this->rollback();
            return [1,$e->getMessage().$e->getFile().$e->getLine()];
        }
    }

    /**
     * 重置箱子数量
     * @param $bid
     * @param $leftKey
     * @param $numKey
     * @return bool|int
     * @throws \think\db\exception\DbException
     */
    public static function resetBoxGoodsNumber($bid, $leftKey, $numKey)
    {
        return Db::name('draw_prizes')
            ->where('did', $bid)
            ->where('is_deleted',0)
            ->update([$leftKey => Db::raw($numKey)]);
    }

}