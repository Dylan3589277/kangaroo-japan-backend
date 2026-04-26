<?php
namespace app\api\controller;


use app\common\model\VipOrders;
use think\App;
use think\facade\Db;


class Levels extends Base
{


    public function __construct(App $app)
    {
        parent::__construct($app);
    }


    public function lists(){
        $levelName = '普通会员';
        $curLevelInfo = false;
        if($this->userInfo['level'] >0){
            $curLevelInfo = Db::name('user_levels')
                ->where('id',$this->userInfo['level'])
                ->find();
            $levelName = $curLevelInfo['name'];
        }
        $data = [
            'nickname' => $this->userInfo['nickname'],
            'avatar' => $this->userInfo['avatar'],
            'level' => $this->userInfo['level'],
            'level_name' => $levelName,
        ];
        //-- 获取所有等级
        $leveList = Db::name('user_levels')
            ->field('id,name,price,level,image,background_image,privilege')
            ->order('level asc')
            ->select()->toArray();
        foreach ($leveList as &$item){
            $item['current_level_status'] = 1;
            if($item['level'] <$this->userInfo['level']){
                $item['current_level_status'] = 0;
            }
            if($item['level'] >$this->userInfo['level']){
                $item['current_level_status'] = -1;
            }

            //-- 计算差额
            $item['offset_amount'] = 0;
            if(in_array($this->userInfo['level'],[1,4])){
                continue;
            }
            if(!$curLevelInfo){
                continue;
            }
            if($item['level'] > $this->userInfo['level']){
                $days = ($this->userInfo['level_end_time'] - time())/86400;
                $offsetPrice = ($item['price'] - $curLevelInfo['price'])/30;
                $item['offset_amount'] = round(intval($days) * $offsetPrice,2);
            }
        }
        $growthRule = [
            '1、会员仅限购买方式获得，会员不同，特权不同；',
            '2、会员到期后，会自动退回到普通会员；'
        ];

        return $this->jsuccess('ok', ['user' => $data,'levels' => $leveList,'times' => VipOrders::getTimes(),'rules' => implode(PHP_EOL,$growthRule)]);
    }

    /**
     * 下单
     */
    public function buy(){
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $level = input('level',0);
        $month = input('month',0);
        if(!in_array($level,[2,3,4])){
            return $this->jerror('请选择合适的等级');
        }
        try {
            $data = (new VipOrders())->addRow($this->userInfo,$level,$month);
            return $this->jsuccess('ok',[
                'order_id' => $data['id'],
                'out_trade_no' => $data['out_trade_no']
            ]);
        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }
    }
}