/*
* Copyright (c) 2017 Ken Hibino.
* Licensed under the MIT License (MIT).
* See https://kenny-hibino.github.io/react-places-autocomplete
*/

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import debounce from 'lodash.debounce'
import defaultStyles from './defaultStyles'

class PlacesAutocomplete extends Component {
  constructor(props) {
    super(props)

    this.state = { autocompleteItems: [] }

    this.autocompleteCallback = this.autocompleteCallback.bind(this)
    this.handleInputKeyDown = this.handleInputKeyDown.bind(this)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.debouncedFetchPredictions = debounce(
      this.fetchPredictions,
      this.props.debounce
    )
    this.clearSuggestions = this.clearSuggestions.bind(this)
  }

  componentDidMount() {
    if (!window.google) {
      throw new Error(
        'Google Maps JavaScript API library must be loaded. See: https://github.com/kenny-hibino/react-places-autocomplete#load-google-library'
      )
    }

    if (!window.google.maps.places) {
      throw new Error(
        'Google Maps Places library must be loaded. Please add `libraries=places` to the src URL. See: https://github.com/kenny-hibino/react-places-autocomplete#load-google-library'
      )
    }

    this.autocompleteService = new google.maps.places.AutocompleteService()
    this.autocompleteOK = google.maps.places.PlacesServiceStatus.OK
  }

  autocompleteCallback(predictions, status) {
    if (status !== this.autocompleteOK) {
      this.props.onError(status, this.clearSuggestions)
      return
    }

    // transform snake_case to camelCase
    const formattedSuggestion = structured_formatting => ({
      mainText: structured_formatting.main_text,
      secondaryText: structured_formatting.secondary_text,
    })

    const { highlightFirstSuggestion } = this.props

    this.setState({
      autocompleteItems: predictions.map((p, idx) => ({
        suggestion: p.description,
        placeId: p.place_id,
        active: highlightFirstSuggestion && idx === 0 ? true : false,
        index: idx,
        formattedSuggestion: formattedSuggestion(p.structured_formatting),
      })),
    })
  }

  fetchPredictions() {
    const { value } = this.props.inputProps
    if (value.length) {
      this.autocompleteService.getPlacePredictions(
        {
          ...this.props.options,
          input: value,
        },
        this.autocompleteCallback
      )
    }
  }

  clearSuggestions() {
    this.setState({ autocompleteItems: [] })
  }

  selectAddress(address, placeId, e) {
    if (e !== undefined) {
      e.preventDefault()
    }
    this.clearSuggestions()
    this.handleSelect(address, placeId)
  }

  handleSelect(address, placeId) {
    this.props.onSelect
      ? this.props.onSelect(address, placeId)
      : this.props.inputProps.onChange(address)
  }

  getActiveItem() {
    return this.state.autocompleteItems.find(item => item.active)
  }

  selectActiveItemAtIndex(index) {
    const activeName = this.state.autocompleteItems.find(
      item => item.index === index
    ).suggestion
    this.setActiveItemAtIndex(index)
    this.props.inputProps.onChange(activeName)
  }

  handleEnterKey() {
    const activeItem = this.getActiveItem()
    if (activeItem === undefined) {
      this.handleEnterKeyWithoutActiveItem()
    } else {
      this.selectAddress(activeItem.suggestion, activeItem.placeId)
    }
  }

  handleEnterKeyWithoutActiveItem() {
    if (this.props.onEnterKeyDown) {
      this.props.onEnterKeyDown(this.props.inputProps.value)
      this.clearSuggestions()
    } else {
      return //noop
    }
  }

  handleDownKey() {
    if (this.state.autocompleteItems.length === 0) {
      return
    }

    const activeItem = this.getActiveItem()
    if (activeItem === undefined) {
      this.selectActiveItemAtIndex(0)
    } else {
      const nextIndex =
        (activeItem.index + 1) % this.state.autocompleteItems.length
      this.selectActiveItemAtIndex(nextIndex)
    }
  }

  handleUpKey() {
    if (this.state.autocompleteItems.length === 0) {
      return
    }

    const activeItem = this.getActiveItem()
    if (activeItem === undefined) {
      this.selectActiveItemAtIndex(this.state.autocompleteItems.length - 1)
    } else {
      let prevIndex
      if (activeItem.index === 0) {
        prevIndex = this.state.autocompleteItems.length - 1
      } else {
        prevIndex = (activeItem.index - 1) % this.state.autocompleteItems.length
      }
      this.selectActiveItemAtIndex(prevIndex)
    }
  }

  handleInputKeyDown(event) {
    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        this.handleEnterKey()
        break
      case 'ArrowDown':
        event.preventDefault() // prevent the cursor from moving
        this.handleDownKey()
        break
      case 'ArrowUp':
        event.preventDefault() // prevent the cursor from moving
        this.handleUpKey()
        break
      case 'Escape':
        this.clearSuggestions()
        break
    }

    if (this.props.inputProps.onKeyDown) {
      this.props.inputProps.onKeyDown(event)
    }
  }

  setActiveItemAtIndex(index) {
    this.setState({
      autocompleteItems: this.state.autocompleteItems.map((item, idx) => {
        if (idx === index) {
          return { ...item, active: true }
        } else {
          return { ...item, active: false }
        }
      }),
    })
  }

  handleInputChange(event) {
    const { value } = event.target
    this.props.inputProps.onChange(value)
    if (!value) {
      this.clearSuggestions()
      return
    }
    if (this.props.shouldFetchSuggestions({ value })) {
      this.debouncedFetchPredictions()
    }
  }

  handleInputOnBlur(event) {
    this.clearSuggestions()

    if (this.props.inputProps.onBlur) {
      this.props.inputProps.onBlur(event)
    }
  }

  inlineStyleFor(...props) {
    const { classNames, styles } = this.props
    // No inline style if className is passed via props for the element.
    if (props.some(prop => classNames.hasOwnProperty(prop))) {
      return {}
    }

    return props.reduce((acc, prop) => {
      return {
        ...acc,
        ...defaultStyles[prop],
        ...styles[prop],
      }
    }, {})
  }

  classNameFor(...props) {
    const { classNames } = this.props

    return props.reduce((acc, prop) => {
      const name = classNames[prop] || ''
      return name ? `${acc} ${name}` : acc
    }, '')
  }

  getInputProps() {
    const defaultInputProps = {
      type: 'text',
      autoComplete: 'off',
    }

    return {
      ...defaultInputProps,
      ...this.props.inputProps,
      onChange: event => {
        this.handleInputChange(event)
      },
      onKeyDown: event => {
        this.handleInputKeyDown(event)
      },
      onBlur: event => {
        this.handleInputOnBlur(event)
      },
      style: this.inlineStyleFor('input'),
      className: this.classNameFor('input'),
    }
  }

  render() {
    const { autocompleteItems } = this.state
    const inputProps = this.getInputProps()

    return (
      <div
        id="PlacesAutocomplete__root"
        style={this.inlineStyleFor('root')}
        className={this.classNameFor('root')}
      >
        <input {...inputProps} />
        {autocompleteItems.length > 0 && (
          <div
            id="PlacesAutocomplete__autocomplete-container"
            style={this.inlineStyleFor('autocompleteContainer')}
            className={this.classNameFor('autocompleteContainer')}
          >
            {autocompleteItems.map((p, idx) => (
              <div
                key={p.placeId}
                onMouseOver={() => this.setActiveItemAtIndex(p.index)}
                onMouseDown={e =>
                  this.selectAddress(p.suggestion, p.placeId, e)
                }
                onTouchStart={() => this.setActiveItemAtIndex(p.index)}
                onTouchEnd={e => this.selectAddress(p.suggestion, p.placeId, e)}
                style={
                  p.active
                    ? this.inlineStyleFor(
                        'autocompleteItem',
                        'autocompleteItemActive'
                      )
                    : this.inlineStyleFor('autocompleteItem')
                }
                className={
                  p.active
                    ? this.classNameFor(
                        'autocompleteItem',
                        'autocompleteItemActive'
                      )
                    : this.classNameFor('autocompleteItem')
                }
              >
                {this.props.renderSuggestion({
                  suggestion: p.suggestion,
                  formattedSuggestion: p.formattedSuggestion,
                })}
              </div>
            ))}
            {this.props.renderFooter && this.props.renderFooter()}
          </div>
        )}
      </div>
    )
  }
}

PlacesAutocomplete.propTypes = {
  inputProps: (props, propName) => {
    const inputProps = props[propName]

    if (!inputProps.hasOwnProperty('value')) {
      throw new Error("'inputProps' must have 'value'.")
    }

    if (!inputProps.hasOwnProperty('onChange')) {
      throw new Error("'inputProps' must have 'onChange'.")
    }
  },
  onError: PropTypes.func,
  onSelect: PropTypes.func,
  renderSuggestion: PropTypes.func,
  classNames: PropTypes.shape({
    root: PropTypes.string,
    input: PropTypes.string,
    autocompleteContainer: PropTypes.string,
    autocompleteItem: PropTypes.string,
    autocompleteItemActive: PropTypes.string,
  }),
  styles: PropTypes.shape({
    root: PropTypes.object,
    input: PropTypes.object,
    autocompleteContainer: PropTypes.object,
    autocompleteItem: PropTypes.object,
    autocompleteItemActive: PropTypes.object,
  }),
  options: PropTypes.shape({
    bounds: PropTypes.object,
    componentRestrictions: PropTypes.object,
    location: PropTypes.object,
    offset: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    radius: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    types: PropTypes.array,
  }),
  debounce: PropTypes.number,
  highlightFirstSuggestion: PropTypes.bool,
  renderFooter: PropTypes.func,
  shouldFetchSuggestions: PropTypes.func.isRequired,
}

PlacesAutocomplete.defaultProps = {
  onError: (status, _clearSuggestions) =>
    console.error(
      '[react-places-autocomplete]: error happened when fetching data from Google Maps API.\nPlease check the docs here (https://developers.google.com/maps/documentation/javascript/places#place_details_responses)\nStatus: ',
      status
    ),
  classNames: {},
  renderSuggestion: ({ suggestion }) => <div>{suggestion}</div>,
  styles: {},
  options: {},
  debounce: 200,
  highlightFirstSuggestion: false,
  shouldFetchSuggestions: () => true,
}

export default PlacesAutocomplete
