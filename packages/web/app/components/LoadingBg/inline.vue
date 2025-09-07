<template>
     <div class="loadingContainer">
        <div class="loadingbar gradient"></div>
        {{ $t('loading') }}
    </div>
</template>

<style lang="scss" scoped>
.loadingContainer{
        position:absolute;
        width:100%;
        height: 100%;
        display: grid;
        place-items: center;
    }
    .loadingbar{
        width: 100%;
        height: 5px;
        position: absolute;
        top: 0;
        left: 0;
        animation: rotate 3s infinite linear;
        -webkit-animation: rotate 3s infinite linear;
    }

.gradient {
    background: var(--app-grey-800); /* Old browsers */
    background: linear-gradient(to right,  var(--app-primary-6) 0%,var(--app-primary-3) 25%,var(--app-success-3) 50%,var(--app-success-1) 75%, var(--app-primary-3) 100%); /* W3C */

}
@keyframes rotate {
  from {
    background-position: -3000px;
  }
  to { 
    background-position: 0px;
  }
}
</style>