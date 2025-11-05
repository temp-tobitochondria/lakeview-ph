<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Watershed extends Model
{
    use \App\Support\Audit\Auditable;
    protected $fillable = ['name','description'];

    // A watershed has many lakes
    public function lakes()
    {
        return $this->hasMany(Lake::class, 'watershed_id', 'id');
    }
    
    public function layers()
    {
        return $this->morphMany(\App\Models\Layer::class, 'body');
    }

    public function activeLayer()
    {
    // With one-layer-per-body, simply expose the single related layer
    return $this->morphOne(\App\Models\Layer::class, 'body');
    }

}
