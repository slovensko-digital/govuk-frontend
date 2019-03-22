import '../../../vendor/polyfills/Function/prototype/bind'
import '../../../vendor/polyfills/Event'

function SdnModal ($module) {
	this.$module = $module
}

SdnModal.prototype.init = function () {
	// Check for module
	var $module = this.$module
	if (!$module || $module.className.indexOf('snd-modal') > -1) {
		return
	}

	$module.querySelector('.sdn-close').addEventListener('click', this.handleClose.bind(this))
}

SdnModal.prototype.handleClose= function (event) {
	event.preventDefault()

	this.$modal.classList.add("hide");
}

SdnModal.prototype.handleClick = function (event) {
	event.preventDefault()

	this.parentNode.classList.toggle('sdn-modal-open')
}

SdnModal.prototype.handleBlur = function (event) {
	event.preventDefault()

	setTimeout(function () {
		this.parentNode.classList.remove('sdn-modal-open')
	}.bind(this), 100)
}

export default SdnModal
