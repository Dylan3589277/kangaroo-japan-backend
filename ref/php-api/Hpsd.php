<?php
namespace app\api\controller;
use app\api\controller\Base;
use app\common\library\Wecom;
use app\common\model\Hpsds;
use app\common\model\OrderConsults;
use think\App;

/**
 * 好评晒单
 */
class Hpsd extends Base
{
    public function __construct(App $app)
    {
        parent::__construct($app);
    }

    /**
     * 提交晒单
     */
    public function submit(){
        //-- 检测未处理的咨询
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $model = new Hpsds();
        $count = $model->where('uid',$this->uid)->where('status',0)->count();
        if($count >= 3){
            return $this->jerror('你还有未处理的晒单，请耐心等待');
        }
        //-- 录入
        $params = input('post.','');
        $params['uid'] = $this->uid;
        list($err,$result) = $model->addRow($params);
        if($err != 0){
            return $this->jerror($result);
        }
        try {
            $alertModel = new Wecom();
            //-- 发送提醒
            $msgArr = [
                '链接:'.$params['remark'],
            ];
            $alertModel->toGroup($alertModel->orderUrl,'好评晒单',$msgArr);
        }catch (\Exception $e){

        }

        return $this->jsuccess('提交成功');
    }

    /**
     * 历史录入
     */
    public function lists(){
        $model = new Hpsds();
        $result = $model
            ->where('uid',$this->uid)
            ->order('id desc')
            ->field('id,uid,pictures,remark,result,status')
            ->paginate(true)->toArray();
        return $this->jsuccess('ok',['list' => $result['data']??[],'total' => intval($result['total'])]);
    }

    /**
     * 取消
     */
    public function cancel(){
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $model = new Hpsds();
        $id = input('id','');
        $info = $model->where('id',intval($id))
            ->where('uid',$this->uid)
            ->where('status',0)
            ->find();
        if(!$info){
            return $this->jerror('该记录不存在或已处理');
        }
        $res = $info->save(['status' => -1]);
        if($res){
            return $this->jsuccess('操作成功');
        }
        return $this->jerror('操作失败，请稍后再试');
    }

}