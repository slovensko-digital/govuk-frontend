import { nodeListForEach } from "../../../common";
import "../../../vendor/polyfills/Function/prototype/bind";
import "../../../vendor/polyfills/Element/prototype/classList";
import {parseRC, isValidRC} from "./input-rodne-cislo-parse"

function SdnInputRodneCislo($module) {
  this.$module = $module;
  this.$input = $module.querySelector('input');
  this.$hint = $module.querySelector('.sdn-input-rodne-cislo-hint');
  this.onChange = this.onChange.bind(this)
}

SdnInputRodneCislo.prototype.init = function() {
  
  this.$input.addEventListener("input", this.onChange);
};

SdnInputRodneCislo.prototype.onChange = function(event) {
  var target = event.target;
  try {
    const info = parseRC(target.value)
    let born = 'Narodený';
    if (info.sex == 'female'){
      born = 'Narodená'
    }
    this.$hint.innerText = `${born} ${info.day}. ${info.month}. ${info.year}.`;
  } catch(e){
    this.$hint.innerText = e.message;
  }
};

export default SdnInputRodneCislo;
